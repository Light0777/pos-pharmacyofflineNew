// services/AutoUpdateService.ts

// __________________________________________________________
// | UPDATE: Consolidated duplicate batches and re-use       |
// | existing batches on re-import.                           |
// |                                                         |
// | WHY: Importing a file with same product+batch multiple   |
// | times (or re-importing the same file) created a new      |
// | ProductBatch record each time instead of updating the    |
// | existing batch's quantity. The fix:                      |
// | 1. Checks ProductBatchModel.findByBatchNumber() before   |
// |    creating a new batch — if exists, passes batch_uuid   |
// |    and updates qty, MRP, rate, GST.                     |
// | 2. Consolidates duplicate product_uuid+batch_number in   |
// |    memory so the same import file with repeated rows     |
// |    creates one batch with summed quantity.               |
// |__________________________________________________________|

import { PurchaseModel } from "../models/Purchase";
import { ProductModel } from "../models/Product";
import { ProductUnitModel } from "../models/ProductUnit";
import { ProductBatchModel } from "../models/ProductBatch";
import { parseExpiryDate, parsePackInfo, mapPackToProductFields } from "../utils/productMapper";
import type { AutoUpdateRequest, SupplierInvoiceItem } from "../types/supplierInvoice";

interface ProcessingResult {
  created: number;
  updated: number;
  errors: Array<{ item: string; error: string }>;
  purchase_uuid?: string;
}

export class AutoUpdateService {

  // Batch size for processing chunks
  private static readonly BATCH_SIZE = 50;

  static async process(data: AutoUpdateRequest): Promise<ProcessingResult> {
    console.log("\n========== BULK AUTO UPDATE ==========");
    console.log(`Processing ${data.items.length} items...`);
    
    const result: ProcessingResult = {
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      // Step 1: Pre-fetch all products in one query
      const productMap = await this.preFetchProducts(data.items);
      
      // Step 2: Process items in batches
      const batches = this.chunkArray(data.items, this.BATCH_SIZE);
      const allPurchaseItems: any[] = [];
      
      for (let i = 0; i < batches.length; i++) {
        console.log(`\nProcessing batch ${i + 1}/${batches.length}...`);
        
        const batchItems = await this.processBatch(
          batches[i], 
          productMap, 
          result
        );
        
        allPurchaseItems.push(...batchItems.filter(Boolean));
      }

      // Step 3: Create single purchase with all items
      if (allPurchaseItems.length > 0) {
        const purchase = PurchaseModel.create({
          supplier_uuid: data.supplier_uuid,
          invoice_number: data.invoice_number,
          invoice_date: data.invoice_date,
          items: allPurchaseItems,
        });
        
        result.purchase_uuid = purchase.purchase_uuid;
        console.log(`\n✓ Purchase Created: ${purchase.purchase_uuid}`);
      }

    } catch (error: any) {
      console.error("Bulk processing error:", error);
      result.errors.push({ item: 'batch', error: error.message });
    }

    console.log(`\n========== COMPLETE ==========`);
    console.log(`Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors.length}`);
    
    return result;
  }

  /**
   * Pre-fetch all products by name, manufacturer, and barcode in bulk
   */
  private static preFetchProducts(items: SupplierInvoiceItem[]): Map<string, any> {
    const productMap = new Map<string, any>();
    const names = new Set<string>();
    const barcodes: string[] = [];

    for (const item of items) {
      names.add(item.product_name.toLowerCase());
      if (item.barcode) barcodes.push(item.barcode);
    }

    // Fetch all products by names in bulk (using LIKE for partial matches)
    for (const name of names) {
      const products = ProductModel.search(name, 100);
      for (const product of products) {
        // Key: name|manufacturer
        const key1 = `${product.name.toLowerCase()}|${(product.manufacturer || '').toLowerCase()}`;
        productMap.set(key1, product);
        
        // Key: name only (first match)
        const key2 = product.name.toLowerCase();
        if (!productMap.has(key2)) {
          productMap.set(key2, product);
        }
      }
    }

    // Fetch by barcodes
    for (const barcode of barcodes) {
      const product = ProductModel.findByBarcode(barcode);
      if (product) {
        productMap.set(`barcode:${barcode}`, product);
      }
    }

    return productMap;
  }

  /**
   * Process a batch of items
   */
  private static async processBatch(
    items: SupplierInvoiceItem[],
    productMap: Map<string, any>,
    result: ProcessingResult
  ): Promise<any[]> {
    
    const purchaseItems: any[] = [];
    
    // Batch create new products
    const newProducts = items.filter(item => {
      const key = `${item.product_name.toLowerCase()}|${(item.manufacturer || '').toLowerCase()}`;
      const nameKey = item.product_name.toLowerCase();
      const barcodeKey = item.barcode ? `barcode:${item.barcode}` : null;
      
      return !productMap.has(key) && 
             !productMap.has(nameKey) && 
             !(barcodeKey && productMap.has(barcodeKey));
    });

    if (newProducts.length > 0) {
      console.log(`Creating ${newProducts.length} new products...`);
      const created = this.bulkCreateProducts(newProducts);
      
      for (const [item, product] of created) {
        const key = `${item.product_name.toLowerCase()}|${(item.manufacturer || '').toLowerCase()}`;
        productMap.set(key, product);
        result.created++;
      }
    }

    // Process all items for purchase
    const rawItems: any[] = [];

    for (const item of items) {
      try {
        const key = `${item.product_name.toLowerCase()}|${(item.manufacturer || '').toLowerCase()}`;
        const nameKey = item.product_name.toLowerCase();
        const barcodeKey = item.barcode ? `barcode:${item.barcode}` : null;
        
        let product = productMap.get(key) || 
                      productMap.get(nameKey) || 
                      (barcodeKey ? productMap.get(barcodeKey) : null);

        if (product) {
          this.enrichExistingProduct(product, item);
          result.updated++;
        } else {
          throw new Error(`Product not found: ${item.product_name}`);
        }

        const unit = this.resolveUnit(product.product_uuid, item);

        // Check if a batch with same product + batch_number already exists in DB
        let batchUuid: string | undefined;
        if (item.batch) {
          const existing = ProductBatchModel.findByBatchNumber(product.product_uuid, item.batch);
          if (existing) {
            // Update existing batch — add to quantity, refresh pricing
            const newQty = Number(existing.quantity) + Number(item.qty);
            ProductBatchModel.update(existing.batch_uuid, {
              quantity: newQty,
              mrp: item.mrp || existing.mrp,
              rate: item.rate || existing.rate,
              purchase_price: item.rate || existing.purchase_price,
              selling_price: item.mrp || existing.selling_price,
              gst_percent: item.gst ?? existing.gst_percent,
              free_quantity: (existing.free_quantity || 0) + (item.free_qty || 0),
            });
            batchUuid = existing.batch_uuid;
          }
        }

        rawItems.push({
          product_uuid: product.product_uuid,
          unit_uuid: unit?.unit_uuid,
          batch_number: item.batch,
          expiry_date: parseExpiryDate(item.expiry),
          quantity: item.qty,
          free_quantity: item.free_qty || 0,
          mrp: item.mrp || 0,
          rate: item.rate || 0,
          cost_price: item.rate || 0,
          selling_price: item.mrp || 0,
          gst_percent: item.gst || 0,
          batch_uuid: batchUuid,
        });

      } catch (error: any) {
        console.error(`Error processing ${item.product_name}:`, error.message);
        result.errors.push({ 
          item: `${item.product_name} (${item.batch})`, 
          error: error.message 
        });
      }
    }

    // Consolidate duplicate product_uuid + batch_number within the same import
    const consolidated = new Map<string, any>();
    for (const pi of rawItems) {
      const key = `${pi.product_uuid}|${pi.batch_number}`;
      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        existing.quantity += pi.quantity;
        existing.free_quantity += pi.free_quantity;
        // Keep the latest values for other fields
        existing.mrp = pi.mrp;
        existing.rate = pi.rate;
        existing.cost_price = pi.cost_price;
        existing.selling_price = pi.selling_price;
        existing.gst_percent = pi.gst_percent;
        existing.expiry_date = pi.expiry_date;
        // If either entry has a batch_uuid, keep it
        if (pi.batch_uuid) existing.batch_uuid = pi.batch_uuid;
      } else {
        consolidated.set(key, { ...pi });
      }
    }

    return Array.from(consolidated.values());
  }

  /**
   * Bulk create products with their units
   */
  private static bulkCreateProducts(
    items: SupplierInvoiceItem[]
  ): Array<[SupplierInvoiceItem, any]> {
    
    const results: Array<[SupplierInvoiceItem, any]> = [];
    
    for (const item of items) {
      try {
        const pack = item.pack ? parsePackInfo(item.pack) : null;
        const productFields = pack ? mapPackToProductFields(pack, item) : {};

        const product = ProductModel.create({
          name: item.product_name,
          manufacturer: item.manufacturer,
          unit: pack?.unit || "Piece",
          price: item.mrp || 0,
          purchase_price: item.rate || 0,
          gst_percent: item.gst || 0,
          stock: 0,
          hsn_code: item.hsn,
          barcode: item.barcode,
          sku: item.sku,
          ...productFields,
        });

        // Create units
        this.createProductUnits(product.product_uuid, item, pack);
        
        results.push([item, product]);
      } catch (error: any) {
        console.error(`Failed to create product ${item.product_name}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Create product units
   */
  private static createProductUnits(
    productUuid: string,
    item: SupplierInvoiceItem,
    pack: ReturnType<typeof parsePackInfo>
  ) {
    ProductUnitModel.create({
      product_uuid: productUuid,
      unit_name: "supplier_unit",
      conversion_factor: 1,
      price: item.mrp || 0,
      purchase_price: item.rate || 0,
      is_base_unit: 1,
      barcode: item.barcode,
    });

    if (!pack) return;

    if (pack.intermediateUnit) {
      const qty = pack.intermediateQty || 1;
      ProductUnitModel.create({
        product_uuid: productUuid,
        unit_name: pack.intermediateUnit.toLowerCase(),
        conversion_factor: qty,
        price: (item.mrp || 0) * qty,
        purchase_price: (item.rate || 0) * qty,
        is_base_unit: 0,
      });
    }

    if (pack.baseUnit && pack.baseUnit !== pack.intermediateUnit) {
      const factor = (pack.intermediateQty || 1) * (pack.baseQty || 1);
      ProductUnitModel.create({
        product_uuid: productUuid,
        unit_name: pack.baseUnit.toLowerCase(),
        conversion_factor: factor,
        price: item.mrp || 0,
        purchase_price: item.rate || 0,
        is_base_unit: 0,
      });
    }
  }

  private static resolveUnit(productUuid: string, item: SupplierInvoiceItem) {
    const units = ProductUnitModel.getByProduct(productUuid);

    const existing = units.find(u => u.unit_name === "supplier_unit");
    if (existing) {
      if (existing.price !== item.mrp || existing.purchase_price !== item.rate) {
        ProductUnitModel.update(existing.unit_uuid, {
          price: item.mrp,
          purchase_price: item.rate,
        });
        return ProductUnitModel.findById(existing.unit_uuid);
      }
      return existing;
    }

    return ProductUnitModel.create({
      product_uuid: productUuid,
      unit_name: "supplier_unit",
      conversion_factor: 1,
      price: item.mrp || 0,
      purchase_price: item.rate || 0,
      is_base_unit: 1,
      barcode: item.barcode,
    });
  }

  private static enrichExistingProduct(product: any, item: SupplierInvoiceItem) {
    const updates: Record<string, any> = {};

    if (item.hsn && !product.hsn_code) updates.hsn_code = item.hsn;
    if (item.manufacturer && product.manufacturer !== item.manufacturer) updates.manufacturer = item.manufacturer;
    if (item.barcode && !product.barcode) updates.barcode = item.barcode;
    if (item.sku && !product.sku) updates.sku = item.sku;
    
    if (Object.keys(updates).length > 0) {
      ProductModel.update(product.product_uuid, updates);
    }
  }

  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
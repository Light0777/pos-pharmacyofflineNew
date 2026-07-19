// services/AutoUpdateService.ts

import { PurchaseModel } from "../models/Purchase";
import { ProductModel } from "../models/Product";
import { ProductUnitModel } from "../models/ProductUnit";
import { ProductBatchModel } from "../models/ProductBatch";
import { parseExpiryDate, parsePackInfo, mapPackToProductFields } from "../utils/productMapper";
import type { AutoUpdateRequest, SupplierInvoiceItem } from "../types/supplierInvoice";
import { ProductUnitDetector, UnitDetectionResult } from "./ProductUnitDetector";
import { ProductCreateInput } from "../types";
import { ProductParser } from "../utils/productParser";

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

  /**
   * Process a single item with smart unit detection
   */
  // services/AutoUpdateService.ts (updated processItemWithUnitDetection)

  private static processItemWithUnitDetection(
    item: SupplierInvoiceItem,
    product: any
  ): {
    unit: any;
    totalQuantity: number;
    unitBreakdown: string;
    purchaseUnit: any;
    purchaseQuantity: number;
  } {
    // Detect the unit from product name
    const detection = ProductUnitDetector.detectUnit(
      item.product_name,
      item.qty
    );

    console.log(`📦 Unit Detection for ${item.product_name}:`, {
      baseUnit: detection.baseUnit,
      packSize: detection.packSize,
      category: detection.unitCategory,
      totalQuantity: detection.totalQuantity,
      breakdown: detection.unitBreakdown
    });

    // Get the purchase unit
    const purchaseUnit = this.getPurchaseUnit(
      product.product_uuid,
      detection,
      item
    );

    // Calculate purchase quantity based on unit
    let purchaseQuantity = item.qty;
    if (purchaseUnit && purchaseUnit.unit_name !== "supplier_unit") {
      // If using a non-supplier unit, quantity remains as is (it's already in that unit)
      purchaseQuantity = item.qty;
    } else {
      // If using supplier unit, we need the total quantity
      purchaseQuantity = detection.totalQuantity;
    }

    // Get or create the appropriate unit
    let unit = this.resolveUnitWithDetection(product.product_uuid, detection, item);

    return {
      unit,
      totalQuantity: detection.totalQuantity,
      unitBreakdown: detection.unitBreakdown,
      purchaseUnit,
      purchaseQuantity
    };
  }

  /**
   * Resolve unit with detection results
   */
  private static resolveUnitWithDetection(
    productUuid: string,
    detection: UnitDetectionResult,
    item: SupplierInvoiceItem
  ): any {
    const units = ProductUnitModel.getByProduct(productUuid);

    // Try to find existing unit matching the detected unit
    let existingUnit = units.find(u =>
      u.unit_name.toLowerCase() === detection.baseUnit ||
      u.unit_name.toLowerCase() === detection.displayUnit.toLowerCase()
    );

    if (existingUnit) {
      // Update existing unit if needed
      const conversionFactor = detection.conversionFactor || 1;
      if (existingUnit.conversion_factor !== conversionFactor) {
        ProductUnitModel.update(existingUnit.unit_uuid, {
          conversion_factor: conversionFactor,
          price: (item.mrp || 0) * conversionFactor,
          purchase_price: (item.rate || 0) * conversionFactor,
        });
        return ProductUnitModel.findById(existingUnit.unit_uuid);
      }
      return existingUnit;
    }

    // Create new unit
    const conversionFactor = detection.conversionFactor || 1;
    return ProductUnitModel.create({
      product_uuid: productUuid,
      unit_name: detection.baseUnit,
      conversion_factor: conversionFactor,
      price: (item.mrp || 0) * conversionFactor,
      purchase_price: (item.rate || 0) * conversionFactor,
      is_base_unit: 0,
      barcode: item.barcode,
    });
  }


  /**
 * Get the appropriate unit for purchase based on detection
 */
  private static getPurchaseUnit(
    productUuid: string,
    detection: UnitDetectionResult,
    item: SupplierInvoiceItem
  ): any {
    const units = ProductUnitModel.getByProduct(productUuid);

    // If it's a strip pack and quantity > 1, use strip unit if available
    if (detection.isStripPack && detection.packSize > 1 && item.qty > 1) {
      const stripUnit = units.find(u => u.unit_name.toLowerCase() === "strip");
      if (stripUnit) {
        return stripUnit;
      }
    }

    // If it's bottled tablets, use bottle unit if available
    if (detection.unitCategory === "Bottled Tablets" && detection.packSize > 1 && item.qty > 1) {
      const bottleUnit = units.find(u => u.unit_name.toLowerCase() === "bottle");
      if (bottleUnit) {
        return bottleUnit;
      }
    }

    // For liquids, use the liquid unit if available
    if (detection.unitCategory === "Liquids" && detection.packSize > 1) {
      const liquidUnit = units.find(u =>
        u.unit_name.toLowerCase() === detection.baseUnit.toLowerCase()
      );
      if (liquidUnit) {
        return liquidUnit;
      }
    }

    // Default to supplier unit
    return units.find(u => u.unit_name === "supplier_unit") || units[0];
  }
  /**
   * Create product units with smart detection
   */
  // services/AutoUpdateService.ts (updated createProductUnitsWithDetection)

  private static createProductUnitsWithDetection(
    productUuid: string,
    item: SupplierInvoiceItem,
    detection: UnitDetectionResult
  ) {
    // Create base supplier unit (always 1:1)
    const supplierUnit = ProductUnitModel.create({
      product_uuid: productUuid,
      unit_name: "supplier_unit",
      conversion_factor: 1,
      price: item.mrp || 0,
      purchase_price: item.rate || 0,
      is_base_unit: 1,
      barcode: item.barcode,
    });

    // Create the detected unit if it's different from supplier unit
    const conversionFactor = detection.conversionFactor || 1;
    if (conversionFactor > 1) {
      // Check if unit already exists
      const existingUnits = ProductUnitModel.getByProduct(productUuid);
      const unitExists = existingUnits.some(u =>
        u.unit_name.toLowerCase() === detection.baseUnit.toLowerCase()
      );

      if (!unitExists) {
        ProductUnitModel.create({
          product_uuid: productUuid,
          unit_name: detection.baseUnit,
          conversion_factor: conversionFactor,
          price: (item.mrp || 0) * conversionFactor,
          purchase_price: (item.rate || 0) * conversionFactor,
          is_base_unit: 0,
          // We can store the category in the unit_name or as metadata
        });
      }
    }

    // If it's a strip pack, also create a strip unit
    if (detection.isStripPack && detection.packSize > 1) {
      const existingUnits = ProductUnitModel.getByProduct(productUuid);
      const stripExists = existingUnits.some(u =>
        u.unit_name.toLowerCase() === "strip"
      );

      if (!stripExists) {
        ProductUnitModel.create({
          product_uuid: productUuid,
          unit_name: "strip",
          conversion_factor: detection.packSize,
          price: (item.mrp || 0) * detection.packSize,
          purchase_price: (item.rate || 0) * detection.packSize,
          is_base_unit: 0,
        });
      }
    }

    // For bottled tablets, create a bottle unit
    if (detection.unitCategory === "Bottled Tablets" && detection.packSize > 1) {
      const existingUnits = ProductUnitModel.getByProduct(productUuid);
      const bottleExists = existingUnits.some(u =>
        u.unit_name.toLowerCase() === "bottle"
      );

      if (!bottleExists) {
        ProductUnitModel.create({
          product_uuid: productUuid,
          unit_name: "bottle",
          conversion_factor: detection.packSize,
          price: (item.mrp || 0) * detection.packSize,
          purchase_price: (item.rate || 0) * detection.packSize,
          is_base_unit: 0,
        });
      }
    }

    return supplierUnit;
  }

  // services/AutoUpdateService.ts (updated bulkCreateProducts)

  private static bulkCreateProducts(
    items: SupplierInvoiceItem[]
  ): Array<[SupplierInvoiceItem, any]> {

    const results: Array<[SupplierInvoiceItem, any]> = [];

    for (const item of items) {
      try {
        // Detect unit first
        const detection = ProductUnitDetector.detectUnit(
          item.product_name,
          item.qty || 1
        );

        // Map detection to product fields
        const productInput = this.mapDetectionToProductInput(detection, item);

        // Parse pack info for additional fields
        const pack = item.pack ? parsePackInfo(item.pack) : null;
        const packFields = pack ? mapPackToProductFields(pack, item) : {};

        const product = ProductModel.create({
          name: item.product_name,
          manufacturer: item.manufacturer,
          unit: detection.baseUnit,
          price: item.mrp || 0,
          purchase_price: item.rate || 0,
          gst_percent: item.gst || 0,
          stock: 0,
          hsn_code: item.hsn,
          barcode: item.barcode,
          sku: item.sku,
          // Map detection fields
          ...productInput,
          // Add pack fields
          ...packFields,
        });

        // Create units with detection
        this.createProductUnitsWithDetection(
          product.product_uuid,
          item,
          detection
        );

        results.push([item, product]);
      } catch (error: any) {
        console.error(`Failed to create product ${item.product_name}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Map detection results to product input fields
   */
  private static mapDetectionToProductInput(
    detection: UnitDetectionResult,
    item: SupplierInvoiceItem
  ): Partial<ProductCreateInput> {
    const input: Partial<ProductCreateInput> = {};

    // Map unit category to appropriate fields
    switch (detection.unitCategory) {
      case "Tablets / Capsules":
        // For tablets/capsules, we can store additional info in description or composition
        input.description = input.description ?
          `${input.description} | Category: ${detection.unitCategory}` :
          `Category: ${detection.unitCategory}`;

        // If it's a strip pack, set the tablets_per_strip
        if (detection.isStripPack && detection.packSize > 1) {
          input.tablets_per_strip = detection.packSize;
          input.strips_per_box = 1; // Default to 1 strip per box
        }
        break;

      case "Liquids":
        input.description = input.description ?
          `${input.description} | Liquid: ${detection.packSize}${detection.displayUnit}` :
          `Liquid: ${detection.packSize}${detection.displayUnit}`;
        break;

      case "Creams / Ointments":
        input.description = input.description ?
          `${input.description} | Cream: ${detection.packSize}${detection.displayUnit}` :
          `Cream: ${detection.packSize}${detection.displayUnit}`;
        break;

      case "Bottled Tablets":
        input.description = input.description ?
          `${input.description} | Bottled: ${detection.packSize} tablets` :
          `Bottled: ${detection.packSize} tablets`;

        // Set the bottle count
        if (detection.packSize > 1) {
          input.tablets_per_strip = detection.packSize;
        }
        break;

      default:
        // For other categories, store in description
        input.description = input.description ?
          `${input.description} | Unit: ${detection.unitCategory}` :
          `Unit: ${detection.unitCategory}`;
    }

    // Store pack size in a custom field or description
    if (detection.packSize > 1) {
      input.description = input.description ?
        `${input.description} | Pack Size: ${detection.packSize}` :
        `Pack Size: ${detection.packSize}`;
    }

    // If we have a composition or strength info, add it
    const parsed = ProductParser.parseProductName(item.product_name);
    if (parsed.strength) {
      input.composition = parsed.strength;
      input.description = input.description ?
        `${input.description} | Strength: ${parsed.strength}` :
        `Strength: ${parsed.strength}`;
    }

    return input;
  }

  // Updated processBatch method
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
      console.log(`Creating ${newProducts.length} new products with smart unit detection...`);
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

        const {
          unit,
          totalQuantity,
          unitBreakdown,
          purchaseUnit,
          purchaseQuantity
        } = this.processItemWithUnitDetection(
          item,
          product
        );

        console.log(`✅ ${item.product_name}: ${unitBreakdown}`);

        // Check if a batch with same product + batch_number already exists
        let batchUuid: string | undefined;
        if (item.batch) {
          const existing = ProductBatchModel.findByBatchNumber(product.product_uuid, item.batch);
          if (existing) {
            // Update existing batch with the calculated quantity
            const newQty = Number(existing.quantity) + purchaseQuantity;
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
          unit_uuid: purchaseUnit?.unit_uuid || unit?.unit_uuid,
          batch_number: item.batch,
          expiry_date: parseExpiryDate(item.expiry),
          quantity: purchaseQuantity, // Use purchase quantity
          free_quantity: item.free_qty || 0,
          mrp: item.mrp || 0,
          rate: item.rate || 0,
          cost_price: item.rate || 0,
          selling_price: item.mrp || 0,
          gst_percent: item.gst || 0,
          batch_uuid: batchUuid,
          unit_breakdown: unitBreakdown,
          total_units: totalQuantity, // Store total units for reference
        });

      } catch (error: any) {
        console.error(`Error processing ${item.product_name}:`, error.message);
        result.errors.push({
          item: `${item.product_name} (${item.batch})`,
          error: error.message
        });
      }
    }

    // Consolidate duplicate product_uuid + batch_number
    const consolidated = new Map<string, any>();
    for (const pi of rawItems) {
      const key = `${pi.product_uuid}|${pi.batch_number}`;
      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        existing.quantity += pi.quantity;
        existing.free_quantity += pi.free_quantity;
        existing.mrp = pi.mrp;
        existing.rate = pi.rate;
        existing.cost_price = pi.cost_price;
        existing.selling_price = pi.selling_price;
        existing.gst_percent = pi.gst_percent;
        existing.expiry_date = pi.expiry_date;
        if (pi.batch_uuid) existing.batch_uuid = pi.batch_uuid;
        // Keep the most detailed unit breakdown
        if (pi.unit_breakdown && pi.unit_breakdown.length > (existing.unit_breakdown?.length || 0)) {
          existing.unit_breakdown = pi.unit_breakdown;
        }
      } else {
        consolidated.set(key, { ...pi });
      }
    }

    return Array.from(consolidated.values());
  }

  // services/AutoUpdateService.ts (new method)


}
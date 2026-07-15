import { PurchaseModel } from "../models/Purchase";
import { ProductModel } from "../models/Product";
import { ProductUnitModel } from "../models/ProductUnit";
import { parseExpiryDate, parsePackInfo, mapPackToProductFields } from "../utils/productMapper";
import type { AutoUpdateRequest, SupplierInvoiceItem } from "../types/supplierInvoice";

export class AutoUpdateService {

  static process(data: AutoUpdateRequest) {
    console.log("\n========== AUTO UPDATE ==========");
    console.log("Items:", data.items.length);

    const purchaseItems = data.items.map(item => this.processItem(item));

    console.log("\nPurchase Payload");
    console.dir(purchaseItems, { depth: null });

    const purchase = PurchaseModel.create({
      supplier_uuid: data.supplier_uuid,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      items: purchaseItems,
    });

    console.log("\nPurchase Created");
    console.log("Purchase UUID:", purchase.purchase_uuid);

    return {
      success: true,
      purchase_uuid: purchase.purchase_uuid,
      purchaseItems,
    };
  }

  private static processItem(item: SupplierInvoiceItem) {
    const product = this.resolveProduct(item);
    const unit = this.resolveUnit(product.product_uuid, item);

    this.logResolved(product, unit);

    return {
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
    };
  }

  private static resolveProduct(item: SupplierInvoiceItem) {
    console.log("\n--------------------------------");
    console.log("Searching Product:", item.product_name, item.manufacturer);

    const byNameAndMfr = ProductModel.findByNameAndManufacturer(item.product_name, item.manufacturer);
    if (byNameAndMfr) {
      console.log("✓ Found by Name & Manufacturer");
      this.enrichExistingProduct(byNameAndMfr, item);
      return byNameAndMfr;
    }

    const byName = ProductModel.findByName(item.product_name);
    if (byName) {
      console.log("✓ Found by Name");
      this.enrichExistingProduct(byName, item);
      return byName;
    }

    if (item.barcode) {
      const byBarcode = ProductModel.findByBarcode(item.barcode);
      if (byBarcode) {
        console.log("✓ Found by Barcode");
        this.enrichExistingProduct(byBarcode, item);
        return byBarcode;
      }
    }

    console.log("✗ Not Found → Creating new product");
    return this.createProduct(item);
  }

  private static resolveUnit(productUuid: string, item: SupplierInvoiceItem) {
    const units = ProductUnitModel.getByProduct(productUuid);
    const pack = item.pack ? parsePackInfo(item.pack) : null;

    const existing = units.find(u => u.unit_name === "supplier_unit");
    if (existing) {
      console.log("Using existing supplier_unit");
      return this.syncUnitPrices(existing, item);
    }

    if (pack) {
      console.log("Creating supplier_unit from pack:", item.pack);
      return this.createUnitFromPack(productUuid, item);
    }

    if (units.length > 0) {
      console.log("Cloning existing unit:", units[0].unit_name);
      return ProductUnitModel.create({
        product_uuid: productUuid,
        unit_name: "supplier_unit",
        conversion_factor: units[0].conversion_factor || 1,
        price: item.mrp || 0,
        purchase_price: item.rate || 0,
        is_base_unit: 0,
        barcode: item.barcode,
      });
    }

    console.log("Creating default supplier_unit");
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

  private static createProduct(item: SupplierInvoiceItem) {
    const pack = item.pack ? parsePackInfo(item.pack) : null;
    const productFields = pack ? mapPackToProductFields(pack, item) : {};

    const product = ProductModel.create({
      name: item.product_name,
      manufacturer: item.manufacturer,
      unit: pack?.unit || "supplier_unit",
      price: item.mrp || 0,
      purchase_price: item.rate || 0,
      gst_percent: item.gst || 0,
      stock: 0,
      hsn_code: item.hsn,
      barcode: item.barcode,
      sku: item.sku,
      ...productFields,
    });

    console.log("✓ Product Created:", product.product_uuid, product.name);
    this.createProductUnits(product.product_uuid, item, pack);
    return product;
  }

  private static createProductUnits(
    productUuid: string,
    item: SupplierInvoiceItem,
    pack: ReturnType<typeof parsePackInfo>
  ) {
    console.log("Creating product units...");

    // Base supplier unit
    ProductUnitModel.create({
      product_uuid: productUuid,
      unit_name: "supplier_unit",
      conversion_factor: 1,
      price: item.mrp || 0,
      purchase_price: item.rate || 0,
      is_base_unit: 1,  // number, not boolean
      barcode: item.barcode,
    });

    if (!pack) {
      console.log("✓ Units created (supplier_unit only)");
      return;
    }

    // Intermediate unit (e.g., Strip)
    if (pack.intermediateUnit) {
      const qty = pack.intermediateQty || 1;
      ProductUnitModel.create({
        product_uuid: productUuid,
        unit_name: pack.intermediateUnit.toLowerCase(),
        conversion_factor: qty,
        price: (item.mrp || 0) * qty,
        purchase_price: (item.rate || 0) * qty,
        is_base_unit: 0,  // number, not boolean
      });
    }

    // Base unit (e.g., Tablet)
    if (pack.baseUnit && pack.baseUnit !== pack.intermediateUnit) {
      const factor = (pack.intermediateQty || 1) * (pack.baseQty || 1);
      ProductUnitModel.create({
        product_uuid: productUuid,
        unit_name: pack.baseUnit.toLowerCase(),
        conversion_factor: factor,
        price: item.mrp || 0,
        purchase_price: item.rate || 0,
        is_base_unit: 0,  // number, not boolean
      });
    }

    console.log("✓ Units created");
  }

  private static enrichExistingProduct(product: any, item: SupplierInvoiceItem) {
    const updates: Record<string, any> = {};

    if (item.hsn && !product.hsn_code) updates.hsn_code = item.hsn;
    if (item.manufacturer && product.manufacturer !== item.manufacturer) updates.manufacturer = item.manufacturer;
    if (item.barcode && !product.barcode) updates.barcode = item.barcode;
    if (item.sku && !product.sku) updates.sku = item.sku;
    if (item.mrp && product.price !== item.mrp) updates.price = item.mrp;
    if (item.rate && product.purchase_price !== item.rate) updates.purchase_price = item.rate;
    if (item.gst !== undefined && product.gst_percent !== item.gst) updates.gst_percent = item.gst;

    if (typeof item.pack === 'string' && item.pack && !product.tablets_per_strip) {
      const packInfo = parsePackInfo(item.pack);
      if (packInfo) {
        Object.assign(updates, mapPackToProductFields(packInfo, item));
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log("Updating product:", updates);
      ProductModel.update(product.product_uuid, updates);
    }
  }

  private static syncUnitPrices(unit: any, item: SupplierInvoiceItem) {
    if (unit.price !== item.mrp || unit.purchase_price !== item.rate) {
      ProductUnitModel.update(unit.unit_uuid, {
        price: item.mrp,
        purchase_price: item.rate,
      });
      return ProductUnitModel.findById(unit.unit_uuid);
    }
    return unit;
  }

  private static createUnitFromPack(productUuid: string, item: SupplierInvoiceItem) {
    return ProductUnitModel.create({
      product_uuid: productUuid,
      unit_name: "supplier_unit",
      conversion_factor: 1,
      price: item.mrp || 0,
      purchase_price: item.rate || 0,
      is_base_unit: 1,  // number, not boolean
      barcode: item.barcode,
    });
  }

  private static logResolved(product: any, unit: any) {
    console.log("Resolved Product:");
    console.table({ uuid: product.product_uuid, name: product.name, unit: product.unit });
    console.log("Resolved Unit:");
    console.table({ unit_uuid: unit?.unit_uuid, unit_name: unit?.unit_name });
  }
}
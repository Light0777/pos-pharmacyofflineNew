export const STRONG_HEADERS = [
    "product",
    "product_name",
    "item",
    "description",
    "qty",
    "quantity",
    "batch",
    "expiry",
    "exp",
    "hsn",
    "mrp",
    "rate",
    "gst",
    "amount"
];

export const WEAK_HEADERS = [
    "manufacturer",
    "pack",
    "barcode",
    "sku",
    "discount",
    "disc",
    "price",
    "tax",
    "stock",
    "code",
    "free_qty"
];

export const HEADER_ALIASES: Record<string, string> = {
    // Product
    "product": "product_name",
    "product_name": "product_name",
    "product name": "product_name",
    "item": "product_name",
    "items": "product_name",
    "item name": "product_name",
    "item description": "product_name",
    "description": "product_name",
    "medicine": "product_name",
    "drug": "product_name",

    // Manufacturer
    "mfr": "manufacturer",
    "manufacturer": "manufacturer",
    "manufacturer name": "manufacturer",
    "company": "manufacturer",
    "mfg": "manufacturer",
    "manu": "manufacturer",

    // HSN
    "hsn": "hsn",
    "hns": "hsn",
    "hsn/sac": "hsn",
    "hsn code": "hsn",
    "hsn no": "hsn",

    // Batch
    "batch": "batch",
    "batch no": "batch",
    "batch number": "batch",

    // Expiry
    "expiry": "expiry",
    "expiry date": "expiry",
    "exp": "expiry",
    "exp date": "expiry",

    // Qty
    "qty": "qty",
    "quantity": "qty",

    // Free Qty
    "free": "free_qty",
    "free qty": "free_qty",
    "free quantity": "free_qty",

    // Rate
    "rate": "rate",
    "list price": "rate",
    "list price (inr)": "rate",
    "purchase rate": "rate",
    "buy rate": "rate",
    "unit price": "rate",
    "price": "rate",

    // MRP
    "mrp": "mrp",
    "mrp rs": "mrp",
    "mrp ₹": "mrp",

    // GST
    "gst": "gst",
    "gst %": "gst",
    "tax": "gst",
    "tax %": "gst",

    // Discount
    "disc": "discount",
    "disc %": "discount",
    "discount": "discount",

    // Amount
    "amount": "amount",
    "amount (inr)": "amount",

    // Pack
    "pack": "pack",
    "packing": "pack",
    "pack size": "pack",

    // Barcode
    "barcode": "barcode",
    "bar code": "barcode",

    // SKU
    "sku": "sku",
    "item code": "sku",
    "product code": "sku",
    "code": "sku"
};
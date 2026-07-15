// utils/productMapper.ts

export interface SupplierInvoiceItem {
    manufacturer?: string;
    product_name: string;
    hsn?: string;
    batch: string;
    expiry: string;
    qty: number;
    free_qty?: number;
    mrp: number;
    rate: number;
    gst?: number;
    pack?: string;
    barcode?: string;
    sku?: string;
}

export interface MappedProductInput {
    name: string;
    manufacturer?: string;
    category_uuid?: string;
    barcode?: string;
    sku?: string;
    hsn_code?: string;
    unit: string;
    price: number;
    purchase_price: number;
    gst_percent: number;
    stock: number;
    boxes: number;
    strips_per_box: number;
    tablets_per_strip: number;
    extra_tablets: number;
    price_per_box: number;
    price_per_strip: number;
    price_per_tablet: number;
    batch: MappedBatchInput;
}

export interface MappedBatchInput {
    batch_number: string;
    manufacture_date?: string;
    expiry_date: string;
    quantity: number;
    strips: number;
    bottles?: number;
    ptr: number;
    mrp: number;
}

export interface PackInfo {
    unit: string;              // e.g., "Tablets / Capsules", "Liquids"
    baseUnit: string;          // e.g., "Tablet", "ml"
    baseQty: number;           // e.g., 10 (tablets per strip)
    intermediateUnit?: string; // e.g., "Strip"
    intermediateQty: number;   // e.g., 10 (strips per box)
    boxes: number;
}

/**
 * Parse pack string like "10x10", "15'S", "30ml", "100 Tab"
 */

function parsePack(pack: string): {
    unit: string;
    boxes: number;
    strips_per_box: number;
    tablets_per_strip: number;
    extra_tablets: number;
} {
    // Default values
    const defaults = {
        unit: 'Tablets / Capsules',
        boxes: 1,
        strips_per_box: 0,
        tablets_per_strip: 0,
        extra_tablets: 0,
    };

    if (!pack) return defaults;

    // Strip format: "10x10" (10 strips of 10 tablets)
    const stripMatch = pack.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    if (stripMatch) {
        return {
            unit: 'Tablets / Capsules',
            boxes: 1,
            strips_per_box: parseInt(stripMatch[1]),
            tablets_per_strip: parseInt(stripMatch[2]),
            extra_tablets: 0,
        };
    }

    // Single unit with apostrophe: "15'S", "30'S"
    const apostropheMatch = pack.match(/^(\d+)\s*['']\s*S$/i);
    if (apostropheMatch) {
        const qty = parseInt(apostropheMatch[1]);
        return {
            unit: 'Tablets / Capsules',
            boxes: 1,
            strips_per_box: 1,
            tablets_per_strip: qty,
            extra_tablets: 0,
        };
    }

    // Liquid/Cream format: "30ml", "50gm", "100ml"
    const liquidMatch = pack.match(/^(\d+)\s*(ml|gm|g|mg|L)$/i);
    if (liquidMatch) {
        const qty = parseInt(liquidMatch[1]);
        const measure = liquidMatch[2].toLowerCase();
        let unit = 'Liquids';
        if (measure === 'gm' || measure === 'g' || measure === 'mg') {
            unit = 'Creams / Ointments';
        }
        return {
            unit,
            boxes: 1,
            strips_per_box: 0,
            tablets_per_strip: qty, // Using this field for volume/weight
            extra_tablets: 0,
        };
    }

    // General format: "100 Tab", "50 Caps", "30 Sachets"
    const generalMatch = pack.match(/^(\d+)\s+([A-Za-z]+)$/);
    if (generalMatch) {
        const qty = parseInt(generalMatch[1]);
        const type = generalMatch[2].toLowerCase();

        if (type.includes('tab') || type.includes('caps') || type.includes('pill')) {
            return {
                unit: 'Tablets / Capsules',
                boxes: 1,
                strips_per_box: 1,
                tablets_per_strip: qty,
                extra_tablets: 0,
            };
        }

        return {
            unit: 'Piece',
            boxes: 1,
            strips_per_box: 0,
            tablets_per_strip: 0,
            extra_tablets: 0,
        };
    }

    return defaults;
}

/**
 * Parse expiry date from various formats to YYYY-MM-DD
 */
export function parseExpiryDate(dateStr: string): string {
    if (!dateStr) {
        throw new Error('Expiry date is required');
    }

    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // DD/MM/YYYY format
    const slashParts = dateStr.split('/');
    if (slashParts.length === 3) {
        const [day, month, year] = slashParts;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // DD-MM-YYYY format
    const dashParts = dateStr.split('-');
    if (dashParts.length === 3 && dashParts[0].length === 2) {
        const [day, month, year] = dashParts;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // MM/YYYY format (expiry month/year only)
    const monthYearMatch = dateStr.match(/^(\d{1,2})[\/-](\d{2,4})$/);
    if (monthYearMatch) {
        const month = monthYearMatch[1].padStart(2, '0');
        const year = monthYearMatch[2].length === 2 ? `20${monthYearMatch[2]}` : monthYearMatch[2];
        // Last day of the month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }

    // Mon-YY format (e.g., "Dec-25")
    const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const monYearMatch = dateStr.match(/^([A-Za-z]{3})[-\s](\d{2,4})$/);
    if (monYearMatch) {
        const month = months[monYearMatch[1].toLowerCase()];
        if (month) {
            const year = monYearMatch[2].length === 2 ? `20${monYearMatch[2]}` : monYearMatch[2];
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        }
    }

    // Try native Date parsing as last resort
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }

    throw new Error(`Invalid date format: ${dateStr}`);
}

/**
 * Parse pack string → structured PackInfo
 * Examples: "10x10", "15'S", "30ml", "100 Tab"
 */
export function parsePackInfo(pack: string): PackInfo | null {
    if (!pack) return null;

    // "10x10" → 10 strips × 10 tablets
    const stripMatch = pack.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
    if (stripMatch) {
        return {
            unit: 'Tablets / Capsules',
            baseUnit: 'Tablet',
            baseQty: parseInt(stripMatch[2]),
            intermediateUnit: 'Strip',
            intermediateQty: parseInt(stripMatch[1]),
            boxes: 1,
        };
    }

    // "15'S", "30'S"
    const apostrophe = pack.match(/^(\d+)\s*['']\s*S$/i);
    if (apostrophe) {
        return {
            unit: 'Tablets / Capsules',
            baseUnit: 'Tablet',
            baseQty: parseInt(apostrophe[1]),
            intermediateUnit: 'Strip',
            intermediateQty: 1,
            boxes: 1,
        };
    }

    // "30ml", "50gm", "100mg"
    const liquid = pack.match(/^(\d+)\s*(ml|gm|g|mg|L)$/i);
    if (liquid) {
        const measure = liquid[2].toLowerCase();
        return {
            unit: measure === 'ml' || measure === 'l' ? 'Liquids' : 'Creams / Ointments',
            baseUnit: measure,
            baseQty: parseInt(liquid[1]),
            intermediateQty: 1,
            boxes: 1,
        };
    }

    // "100 Tab", "50 Caps"
    const general = pack.match(/^(\d+)\s+([A-Za-z]+)$/);
    if (general) {
        const qty = parseInt(general[1]);
        const type = general[2].toLowerCase();
        const isTablet = /tab|cap|pill/.test(type);
        return {
            unit: isTablet ? 'Tablets / Capsules' : 'Piece',
            baseUnit: type,
            baseQty: qty,
            intermediateUnit: isTablet ? 'Strip' : undefined,
            intermediateQty: isTablet ? 1 : qty,
            boxes: 1,
        };
    }

    return null;
}

/**
 * Map PackInfo → product creation fields matching manual UI flow
 */
export function mapPackToProductFields(pack: PackInfo, item: { mrp: number; rate: number }) {
    const { baseQty, intermediateQty, boxes, unit } = pack;
    const tps = unit === 'Tablets / Capsules' ? baseQty : 0;
    const spb = unit === 'Tablets / Capsules' ? intermediateQty : 0;

    const pricePerTablet = item.mrp;
    const pricePerStrip = tps ? pricePerTablet * tps : 0;
    const pricePerBox = spb && tps ? pricePerStrip * spb : 0;

    return {
        boxes,
        strips_per_box: spb,
        tablets_per_strip: tps,
        extra_tablets: 0,
        price_per_box: pricePerBox,
        price_per_strip: pricePerStrip,
        price_per_tablet: pricePerTablet,
    };
}

/**
 * Map supplier invoice item to product creation input
 */
export function mapSupplierItemToProduct(item: SupplierInvoiceItem): {
    product: MappedProductInput;
    units: Array<{
        unit_name: string;
        conversion_factor: number;
        price: number;
        purchase_price: number;
        is_base_unit: boolean;
    }>;
} {
    const packInfo = parsePack(item.pack || '');
    const qty = item.qty || 0;
    const mrp = item.mrp || 0;
    const rate = item.rate || 0;
    const gst = item.gst || 0;

    // Calculate pricing based on unit type
    let price_per_box = 0;
    let price_per_strip = 0;
    let price_per_tablet = mrp;
    let boxes = packInfo.boxes;
    let strips_per_box = packInfo.strips_per_box;
    let tablets_per_strip = packInfo.tablets_per_strip;

    if (packInfo.unit === 'Tablets / Capsules') {
        if (strips_per_box > 0 && tablets_per_strip > 0) {
            const totalUnits = boxes * strips_per_box * tablets_per_strip;
            price_per_box = mrp * strips_per_box * tablets_per_strip;
            price_per_strip = mrp * tablets_per_strip;
            price_per_tablet = mrp;
        } else if (tablets_per_strip > 0) {
            // Single strip
            price_per_strip = mrp * tablets_per_strip;
            price_per_tablet = mrp;
        }
    } else {
        // Liquids, Creams, etc.
        price_per_tablet = mrp;
        boxes = 0;
        strips_per_box = 0;
        tablets_per_strip = 0;
    }

    const product: MappedProductInput = {
        name: item.product_name,
        manufacturer: item.manufacturer,
        category_uuid: undefined,
        barcode: item.barcode,
        sku: item.sku,
        hsn_code: item.hsn,
        unit: packInfo.unit,
        price: price_per_tablet,
        purchase_price: rate,
        gst_percent: gst,
        stock: qty,
        boxes,
        strips_per_box,
        tablets_per_strip,
        extra_tablets: packInfo.extra_tablets,
        price_per_box,
        price_per_strip,
        price_per_tablet,
        batch: {
            batch_number: item.batch,
            expiry_date: parseExpiryDate(item.expiry),
            quantity: qty,
            strips: strips_per_box > 0 ? Math.ceil(qty / tablets_per_strip) : qty,
            bottles: undefined,
            ptr: rate,
            mrp: mrp,
        },
    };

    // Create units array (matching manual creation pattern)
    const units = [];
    const baseUnitName = packInfo.unit === 'Tablets / Capsules' ? 'Tablet' :
        packInfo.unit === 'Liquids' ? 'ml' :
            packInfo.unit === 'Creams / Ointments' ? 'gm' : 'Piece';

    // Base unit
    units.push({
        unit_name: baseUnitName,
        conversion_factor: 1,
        price: price_per_tablet,
        purchase_price: rate,
        is_base_unit: true,
    });

    // Strip unit (if applicable)
    if (packInfo.unit === 'Tablets / Capsules' && tablets_per_strip > 0) {
        units.push({
            unit_name: 'Strip',
            conversion_factor: tablets_per_strip,
            price: price_per_strip || (mrp * tablets_per_strip),
            purchase_price: rate * tablets_per_strip,
            is_base_unit: false,
        });
    }

    // Box unit (if applicable)
    if (packInfo.unit === 'Tablets / Capsules' && boxes > 0 && strips_per_box > 0 && tablets_per_strip > 0) {
        units.push({
            unit_name: 'Box',
            conversion_factor: strips_per_box * tablets_per_strip,
            price: price_per_box || (mrp * strips_per_box * tablets_per_strip),
            purchase_price: rate * strips_per_box * tablets_per_strip,
            is_base_unit: false,
        });
    }

    return { product, units };
}

/**
 * Map multiple supplier invoice items to batch format for purchase creation
 */
export function mapSupplierItemsToPurchaseBatches(
    items: SupplierInvoiceItem[],
    productUuidMap: Record<string, string> // batch_number -> product_uuid
): Array<{
    product_uuid: string;
    batch_number: string;
    manufacture_date?: string;
    expiry_date: string;
    quantity: number;
    strips: number;
    ptr: number;
    cost_price: number;
    mrp: number;
}> {
    return items.map(item => {
        const packInfo = parsePack(item.pack || '');
        const tps = packInfo.tablets_per_strip || 1;
        const strips = Math.ceil(item.qty / tps);

        return {
            product_uuid: productUuidMap[item.batch] || '',
            batch_number: item.batch,
            expiry_date: parseExpiryDate(item.expiry),
            quantity: item.qty,
            strips,
            ptr: item.rate,
            cost_price: item.rate,
            mrp: item.mrp,
        };
    });
}
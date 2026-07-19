// utils/productParser.ts

export interface ParsedProductInfo {
  name: string;
  strength: string;
  form: string;
  packSize: number;
  packType: string;
}

export class ProductParser {
  /**
   * Parse product name from various formats
   */
  static parseProductName(rawName: string): ParsedProductInfo {
    let name = rawName.trim();
    let strength = "";
    let form = "";
    let packSize = 1;
    let packType = "strip";

    // Extract strength (e.g., "500mg", "10mcg")
    const strengthMatch = name.match(/(\d+\.?\d*)\s*(mg|mcg|gm|ml|iu|%|mcg|µg)/i);
    if (strengthMatch) {
      strength = `${strengthMatch[1]}${strengthMatch[2]}`;
    }

    // Extract form
    const formMatch = name.match(/\b(tablets|capsules|tablet|capsule|injection|syrup|suspension)\b/i);
    if (formMatch) {
      form = formMatch[1].toLowerCase();
    }

    // Extract pack size
    const sizeMatch = name.match(/(\d+)\s*['s]\s*$/i) || 
                     name.match(/strip\s*(?:of)?\s*(\d+)/i) ||
                     name.match(/pack\s*(?:of)?\s*(\d+)/i);
    if (sizeMatch) {
      packSize = parseInt(sizeMatch[1]);
    }

    // Determine pack type
    if (name.match(/strip|blister/i)) packType = "strip";
    else if (name.match(/bottle|vial/i)) packType = "bottle";
    else if (name.match(/sachet|packet/i)) packType = "sachet";
    else if (name.match(/box|carton/i)) packType = "box";

    // Clean up name (remove pack info)
    let cleanName = name
      .replace(/\s*\(\s*strip\s*of\s*\d+\s*\)\s*/i, "")
      .replace(/\s*strip\s*(?:of)?\s*\d+\s*['s]?\s*/i, "")
      .replace(/\s*pack\s*(?:of)?\s*\d+\s*['s]?\s*/i, "")
      .replace(/\s*\d+['s]\s*$/i, "")
      .trim();

    return {
      name: cleanName,
      strength,
      form,
      packSize,
      packType
    };
  }

  /**
   * Get unit category from form
   */
  static getUnitCategory(form: string): string {
    const categoryMap: Record<string, string> = {
      'tablet': 'Tablets / Capsules',
      'tablets': 'Tablets / Capsules',
      'capsule': 'Tablets / Capsules',
      'capsules': 'Tablets / Capsules',
      'injection': 'Liquids',
      'syrup': 'Liquids',
      'suspension': 'Liquids',
      'cream': 'Creams / Ointments',
      'ointment': 'Creams / Ointments',
      'gel': 'Creams / Ointments'
    };
    return categoryMap[form] || 'General';
  }
}
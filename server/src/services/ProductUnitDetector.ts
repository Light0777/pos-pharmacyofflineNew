// services/ProductUnitDetector.ts

export interface UnitDetectionResult {
  baseUnit: string;           // The base unit (e.g., "tablet", "capsule", "ml")
  packSize: number;           // Number of units per pack/strip
  unitCategory: string;       // From UNIT_OPTIONS
  displayUnit: string;        // Human-readable unit
  conversionFactor: number;   // For quantity calculations
  totalQuantity: number;      // Calculated total quantity
  unitBreakdown: string;      // Detailed breakdown
  isStripPack: boolean;       // Whether it's a strip/pack
}

export class ProductUnitDetector {
  private static readonly UNIT_OPTIONS = [
    "Tablets / Capsules",
    "Liquids", 
    "Creams / Ointments",
    "Devices",
    "Bottled Tablets",
    "Piece",
    "Bandage",
    "General"
  ];

  // Unit patterns for detection
  private static readonly UNIT_PATTERNS = {
    tablets: /\b(tablet|tab|tabs|tablets)\b/i,
    capsules: /\b(capsule|caps|capsules|cap)\b/i,
    liquid: /\b(liquid|solution|suspension|syrup|injection|infusion|drops)\b/i,
    cream: /\b(cream|ointment|gel|paste|lotion|salve)\b/i,
    device: /\b(device|kit|applicator|inhaler|spray|pump)\b/i,
    bandage: /\b(bandage|dressing|plaster|tape|patch)\b/i,
    bottle: /\b(bottle|vial|ampoule|ampule)\b/i,
    strip: /\b(strip|blister|pack|sachet)\b/i
  };

  // Strength/dosage patterns
  private static readonly STRENGTH_PATTERN = /\b(\d+\.?\d*)\s*(mg|mcg|gm|ml|iu|%|mcg|µg)\b/i;
  
  // Pack size patterns
  private static readonly PACK_SIZE_PATTERN = /(?:strip|pack|blister|bottle|sachet)\s*(?:of|with)?\s*(\d+)/i;
  private static readonly QUANTITY_SUFFIX_PATTERN = /(\d+)\s*['s]/i;

  /**
   * Main detection function
   */
  static detectUnit(productName: string, quantity: number = 1): UnitDetectionResult {
    const detection = this.analyzeProduct(productName);
    
    // Calculate total quantity based on detection
    const totalQuantity = this.calculateTotalQuantity(
      detection.packSize || 1,
      quantity,
      detection.isStripPack
    );

    return {
      baseUnit: detection.baseUnit,
      packSize: detection.packSize || 1,
      unitCategory: detection.unitCategory,
      displayUnit: detection.displayUnit,
      conversionFactor: detection.conversionFactor || 1,
      totalQuantity: totalQuantity,
      unitBreakdown: this.generateUnitBreakdown(detection, quantity, totalQuantity),
      isStripPack: detection.isStripPack || false
    };
  }

  /**
   * Analyze product name to determine units
   */
  private static analyzeProduct(productName: string): any {
    const lowerName = productName.toLowerCase();
    
    // Determine base unit
    let baseUnit = "piece";
    let unitCategory = "General";
    let isStripPack = false;
    let packSize = 1;
    let displayUnit = "Piece";
    let conversionFactor = 1;

    // Check for tablets/capsules
    if (this.UNIT_PATTERNS.tablets.test(lowerName) || 
        this.UNIT_PATTERNS.capsules.test(lowerName)) {
      baseUnit = this.UNIT_PATTERNS.tablets.test(lowerName) ? "tablet" : "capsule";
      unitCategory = "Tablets / Capsules";
      displayUnit = baseUnit.charAt(0).toUpperCase() + baseUnit.slice(1);
      
      // Check if it's a strip pack
      if (this.UNIT_PATTERNS.strip.test(lowerName)) {
        isStripPack = true;
        packSize = this.extractPackSize(productName);
        conversionFactor = packSize;
      }
    }
    // Check for liquids
    else if (this.UNIT_PATTERNS.liquid.test(lowerName)) {
      baseUnit = "ml";
      unitCategory = "Liquids";
      displayUnit = "mL";
      
      // Extract volume if present
      const volume = this.extractVolume(productName);
      if (volume) {
        packSize = volume;
        conversionFactor = volume;
      }
    }
    // Check for creams/ointments
    else if (this.UNIT_PATTERNS.cream.test(lowerName)) {
      baseUnit = "gm";
      unitCategory = "Creams / Ointments";
      displayUnit = "g";
      
      const weight = this.extractWeight(productName);
      if (weight) {
        packSize = weight;
        conversionFactor = weight;
      }
    }
    // Check for devices
    else if (this.UNIT_PATTERNS.device.test(lowerName)) {
      baseUnit = "device";
      unitCategory = "Devices";
      displayUnit = "Device";
      conversionFactor = 1;
    }
    // Check for bandages
    else if (this.UNIT_PATTERNS.bandage.test(lowerName)) {
      baseUnit = "piece";
      unitCategory = "Bandage";
      displayUnit = "Piece";
      conversionFactor = 1;
    }
    // Check for bottled tablets
    else if (this.UNIT_PATTERNS.bottle.test(lowerName) && 
             (this.UNIT_PATTERNS.tablets.test(lowerName) || 
              this.UNIT_PATTERNS.capsules.test(lowerName))) {
      baseUnit = this.UNIT_PATTERNS.tablets.test(lowerName) ? "tablet" : "capsule";
      unitCategory = "Bottled Tablets";
      displayUnit = baseUnit.charAt(0).toUpperCase() + baseUnit.slice(1);
      
      const count = this.extractBottleCount(productName);
      if (count) {
        packSize = count;
        conversionFactor = count;
      }
    }

    return {
      baseUnit,
      unitCategory,
      isStripPack,
      packSize,
      displayUnit,
      conversionFactor
    };
  }

  /**
   * Extract pack size from product name
   */
  private static extractPackSize(productName: string): number {
    // Try pattern: "Strip of 10"
    let match = productName.match(/strip\s*(?:of)?\s*(\d+)/i);
    if (match) return parseInt(match[1]);

    // Try pattern: "Strip 10's"
    match = productName.match(/strip\s*(\d+)['s]/i);
    if (match) return parseInt(match[1]);

    // Try pattern: "10's" at end
    match = productName.match(/(\d+)['s]\s*$/i);
    if (match) return parseInt(match[1]);

    // Try pattern: "Pack of 15"
    match = productName.match(/pack\s*(?:of)?\s*(\d+)/i);
    if (match) return parseInt(match[1]);

    // Try pattern: "15 Tablets"
    match = productName.match(/(\d+)\s*(?:tablets|capsules)/i);
    if (match) return parseInt(match[1]);

    return 1;
  }

  /**
   * Extract volume from liquid products
   */
  private static extractVolume(productName: string): number | null {
    const match = productName.match(/(\d+\.?\d*)\s*(ml|mL)/i);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Extract weight from cream products
   */
  private static extractWeight(productName: string): number | null {
    const match = productName.match(/(\d+\.?\d*)\s*(gm|g|gram)/i);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Extract count from bottled products
   */
  private static extractBottleCount(productName: string): number | null {
    const match = productName.match(/bottle\s*(?:of)?\s*(\d+)\s*(?:tablets|capsules)/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Calculate total quantity
   */
  private static calculateTotalQuantity(
    packSize: number,
    quantity: number,
    isStripPack: boolean
  ): number {
    if (isStripPack) {
      // If it's a strip pack, multiply pack size by quantity
      return packSize * quantity;
    }
    // For other units, quantity is the total
    return quantity;
  }

  /**
   * Generate human-readable unit breakdown
   */
  private static generateUnitBreakdown(
    detection: any,
    quantity: number,
    totalQuantity: number
  ): string {
    const { baseUnit, packSize, isStripPack } = detection;
    
    if (isStripPack && packSize > 1) {
      return `${packSize} ${baseUnit}s per strip × ${quantity} strip${quantity > 1 ? 's' : ''} = ${totalQuantity} ${baseUnit}s`;
    } else if (packSize > 1) {
      return `${packSize} ${baseUnit}s per pack × ${quantity} pack${quantity > 1 ? 's' : ''} = ${totalQuantity} ${baseUnit}s`;
    }
    
    return `${totalQuantity} ${baseUnit}${totalQuantity > 1 ? 's' : ''}`;
  }

  /**
   * Process invoice items with quantity calculation
   */
  static processInvoiceItems(items: Array<{ product: string; qty: number }>): Array<{
    product: string;
    originalQty: number;
    detectedUnit: UnitDetectionResult;
    totalUnits: number;
  }> {
    return items.map(item => {
      const detected = this.detectUnit(item.product, item.qty);
      return {
        product: item.product,
        originalQty: item.qty,
        detectedUnit: detected,
        totalUnits: detected.totalQuantity
      };
    });
  }

  /**
   * Validate if unit allocation makes sense
   */
  static validateUnitAllocation(
    productName: string,
    proposedUnit: string,
    quantity: number
  ): { valid: boolean; message: string } {
    const detection = this.detectUnit(productName);
    
    // Check if unit matches detected category
    const validUnits = this.getValidUnitsForCategory(detection.unitCategory);
    
    if (!validUnits.includes(proposedUnit.toLowerCase())) {
      return {
        valid: false,
        message: `Unit "${proposedUnit}" not valid for "${detection.unitCategory}". Suggested: ${validUnits.join(', ')}`
      };
    }

    // Validate quantity makes sense
    if (quantity <= 0) {
      return {
        valid: false,
        message: 'Quantity must be greater than 0'
      };
    }

    return {
      valid: true,
      message: 'Unit allocation valid'
    };
  }

  /**
   * Get valid units for a category
   */
  private static getValidUnitsForCategory(category: string): string[] {
    const unitMap: Record<string, string[]> = {
      'Tablets / Capsules': ['tablet', 'capsule', 'tablets', 'capsules'],
      'Liquids': ['ml', 'mls', 'liter', 'litre', 'l'],
      'Creams / Ointments': ['gm', 'g', 'gram', 'grams'],
      'Devices': ['device', 'devices', 'piece'],
      'Bottled Tablets': ['tablet', 'capsule', 'tablets', 'capsules'],
      'Piece': ['piece', 'pieces'],
      'Bandage': ['piece', 'pieces', 'bandage'],
      'General': ['piece', 'pieces', 'unit', 'units']
    };

    return unitMap[category] || ['piece', 'units'];
  }
}
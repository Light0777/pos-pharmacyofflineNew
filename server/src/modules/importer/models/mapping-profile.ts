export interface MappingProfile {
  profileName: string;
  module: "purchase";

  fields: {
    manufacturer: string;

    product_name: string;

    hsn: string;

    batch: string;

    expiry: string;

    qty: string;

    free_qty: string;

    mrp: string;

    rate: string;

    gst: string;

    pack: string;

    barcode: string;

    sku: string;
  };
}
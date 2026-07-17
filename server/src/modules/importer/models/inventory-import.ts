export interface InventoryImport {

    productName: string;

    batchNo: string;

    expiry: string;

    quantity: number;

    purchasePrice: number;

    tax: number;

    hsn: string;

    discount?: number;

    amount?: number;

}
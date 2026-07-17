import { ImportRow } from "../models/import-row";
import { InventoryImport } from "../models/inventory-import";
import { MappingProfile } from "../models/mapping-profile";

export class Mapper {

    map(
        rows: ImportRow[],
        profile: MappingProfile
    ): InventoryImport[] {

        return rows.map(row => {

            return {

                productName: row[profile.fields.productName],

                batchNo: row[profile.fields.batchNo],

                expiry: row[profile.fields.expiry],

                quantity: Number(row[profile.fields.quantity]),

                purchasePrice: Number(row[profile.fields.purchasePrice]),

                tax: Number(row[profile.fields.tax]),

                hsn: row[profile.fields.hsn],

                discount: Number(row[profile.fields.discount] ?? 0),

                amount: Number(row[profile.fields.amount] ?? 0)

            };

        });

    }

}
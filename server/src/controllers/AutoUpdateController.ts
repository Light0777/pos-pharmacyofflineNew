import type { Request, Response } from "express";

import { AutoUpdateService } from "../services/AutoUpdateService";
import { AutoUpdateRequest } from "../types/supplierInvoice";

export async function AutoUpdateController(req: any, res: any) {

    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body:", req.body);
    
    try {
        const data: AutoUpdateRequest = req.body;

        // Validate
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No items provided'
            });
        }

        console.log(`\n📦 Processing invoice with ${data.items.length} items`);

        // For large imports, use streaming response
        if (data.items.length > 100) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Transfer-Encoding', 'chunked');
        }

        const result = await AutoUpdateService.process(data);

        // Return appropriate response
        if (result.errors.length > 0) {
            return res.status(207).json({
                success: true,
                partial: true,
                ...result,
                message: `Processed with ${result.errors.length} errors. Created: ${result.created}, Updated: ${result.updated}`
            });
        }

        return res.json({
            success: true,
            ...result,
            message: `Successfully processed ${data.items.length} items. Created: ${result.created}, Updated: ${result.updated}`
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Import failed'
        });
    }
}
import type { Request, Response } from "express";

import { AutoUpdateService } from "../services/AutoUpdateService";

export class AutoUpdateController {

    static import = (req: Request, res: Response): void => {

        try {

            const result = AutoUpdateService.process(req.body);

            res.json(result);

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message: "Import failed"

            });

        }

    };

}
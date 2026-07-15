import { Router } from "express";

import { authenticate, authorize } from "../middleware/auth";

import { AutoUpdateController } from "../controllers/AutoUpdateController";

const router = Router();

router.use(authenticate);

router.post(
    "/",
    authorize("admin"),
    AutoUpdateController
);

export default router;
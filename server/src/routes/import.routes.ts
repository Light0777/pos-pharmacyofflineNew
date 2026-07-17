import { Router } from "express";
// @ts-ignore: Multer has no bundled type declarations in this project
import multer from "multer";
import path from "path";
import { ImportController } from "../controllers/import.controller";

const router = Router();

const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
});

router.post(
  "/excel",
  upload.single("file"),
  ImportController.importExcel
);

router.post("/commit", ImportController.commitImport);

export default router;
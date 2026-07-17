// __________________________________________________________
// | UPDATE: Changed multer dest from process.cwd() + /uploads |
// | to os.tmpdir() + /pos-pharmacy-imports with mkdirSync.   |
// |                                                           |
// | WHY: In production (packaged Electron), process.cwd()     |
// | points to the app.asar archive (read-only). Multer tries  |
// | to write the uploaded file there and fails. os.tmpdir()   |
// | is always writable on any platform.                       |
// |__________________________________________________________|

import { Router } from "express";
// @ts-ignore: Multer has no bundled type declarations in this project
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { ImportController } from "../controllers/import.controller";

const router = Router();

const uploadDir = path.join(os.tmpdir(), "pos-pharmacy-imports");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
});

router.post(
  "/file",
  upload.single("file"),
  ImportController.importFile
);


export default router;
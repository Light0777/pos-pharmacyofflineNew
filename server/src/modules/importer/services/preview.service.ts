import fs from "fs/promises";
import path from "path";
import { MappingProfile } from "../models/mapping-profile";

// Use project root to locate profiles directory to avoid using import.meta
const profilesDir = path.join(
  process.cwd(),
  "server",
  "src",
  "modules",
  "importer",
  "profiles"
);

export class ProfileService {
  async getDefault(module: string): Promise<MappingProfile> {
    const file = path.join(profilesDir, `${module}.default.json`);

    const json = await fs.readFile(file, "utf8");

    return JSON.parse(json);
  }

  async getProfile(profile: string): Promise<MappingProfile> {
    const file = path.join(profilesDir, `${profile}.json`);

    const json = await fs.readFile(file, "utf8");

    return JSON.parse(json);
  }
}
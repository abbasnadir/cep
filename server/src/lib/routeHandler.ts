import fs from "fs/promises";
import path from "path";
import { Router } from "express";

import { tryCatch } from "../utils/tryCatch.js";
import type { RouterObject } from "../../types/router.js";
import { authHandler } from "./auth.js";
import { rateLimiter } from "./rateLimiter.js";

export async function routesHandler(): Promise<Router> {
  const parentDir = path.join(import.meta.dirname, "../routes");
  const router = Router();

  try {
    const directory = await fs.readdir(parentDir, {
      withFileTypes: true,
    });

    const runtimeFiles = directory
      .filter((dirent) => !dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => /\.(ts|js|cjs|mjs)$/i.test(name))
      .filter((name) => !/\.d\.(ts|js|cjs|mjs)$/i.test(name))
      .sort((left, right) => left.localeCompare(right));

    const modulePreference = [".ts", ".js", ".mjs", ".cjs"];
    const selectedFiles = new Map<string, string>();

    for (const file of runtimeFiles) {
      const matchedExtension = modulePreference.find((extension) =>
        file.endsWith(extension),
      );

      if (!matchedExtension) continue;

      const baseName = file.slice(0, -matchedExtension.length);
      const existing = selectedFiles.get(baseName);

      if (!existing) {
        selectedFiles.set(baseName, file);
        continue;
      }

      const existingExtension =
        modulePreference.find((extension) => existing.endsWith(extension)) ?? ".js";

      if (
        modulePreference.indexOf(matchedExtension) <
        modulePreference.indexOf(existingExtension)
      ) {
        selectedFiles.set(baseName, file);
      }
    }

    for (const file of selectedFiles.values()) {
      const module = await import(path.join(parentDir, file));
      const routerObj: RouterObject = module.default;

      for (const obj of routerObj.functions) {
        const fullPath = routerObj.path + (obj.props ?? "");

        router[obj.method](
          fullPath,
          authHandler(obj.authorization),
          rateLimiter.limit(obj.rateLimit, obj.keyType),
          tryCatch(obj.handler)
        );
      }
    }

    return router;
  } catch (err) {
    console.error("[routesHandler] Failed to read routes directory:", err);
    throw err;
  }
}

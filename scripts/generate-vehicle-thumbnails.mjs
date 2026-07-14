import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { createServer } from "vite";
import { VEHICLE_MODELS } from "../src/components/vehicles/vehicleConfig.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selectorDir = path.join(rootDir, "public", "images", "vehicles");
const loadingDir = path.join(rootDir, "public", "images", "loading-vehicles");
const tempDir = path.join(process.env.TEMP || process.env.TMP || rootDir, "opencode-vehicle-thumbs");
const backupDir = path.join(tempDir, "backup");
const variants = [
  { name: "selector", outputDir: selectorDir, captureSize: 1024, outputSize: 1024, trimMargin: 24 },
  { name: "loading", outputDir: loadingDir, captureSize: 2048, outputSize: 1024, trimMargin: 64 },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function backupExisting(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    return;
  }

  const rel = path.relative(rootDir, filePath);
  const target = path.join(backupDir, rel);
  await ensureDir(path.dirname(target));
  await fs.copyFile(filePath, target);
}

async function main() {
  await ensureDir(selectorDir);
  await ensureDir(loadingDir);
  await ensureDir(tempDir);

  const server = await createServer({
    root: rootDir,
    server: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: false,
    },
  });

  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 4173;

  const browser = await chromium.launch({ headless: true });

  try {
    for (const variant of variants) {
      for (const model of VEHICLE_MODELS) {
        const outputPath = path.join(variant.outputDir, `${model}.png`);
        const tempShot = path.join(tempDir, `${variant.name}-${model}.shot.png`);

        await backupExisting(outputPath);

        const page = await browser.newPage({
          viewport: { width: variant.captureSize, height: variant.captureSize },
          deviceScaleFactor: 1,
        });

        await page.goto(
          `http://127.0.0.1:${port}/thumbs.html?model=${encodeURIComponent(model)}&variant=${variant.name}`,
          { waitUntil: "networkidle" },
        );

        await page.waitForFunction(() => window.__THUMB_READY__ === true, null, { timeout: 30000 });
        await page.screenshot({ path: tempShot, omitBackground: true });

        await sharp(tempShot)
          .trim({ threshold: 0, margin: variant.trimMargin })
          .resize(variant.outputSize, variant.outputSize, {
            fit: "contain",
            position: "center",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toFile(outputPath);

        await page.close();
        console.log(`wrote ${path.relative(rootDir, outputPath)}`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(`backup stored in ${backupDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(rootDir, "public", "models", "lunar1-rocks.glb");

async function main() {
  const server = await createServer({
    root: rootDir,
    server: {
      host: "127.0.0.1",
      port: 4174,
      strictPort: false,
    },
  });

  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 4174;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    await page.goto(`http://127.0.0.1:${port}/bake-rocks.html`);

    const moduleUrl = `http://127.0.0.1:${port}/scripts/bake-rocks-page.mjs?v=${Date.now()}`;
    const bytes = await page.evaluate(async (url) => {
      const mod = await import(url);
      return await mod.bakeRocks();
    }, moduleUrl);

    await fs.writeFile(outPath, Buffer.from(bytes));
    await page.close();
    console.log(`wrote ${path.relative(rootDir, outPath)}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Runs the production standalone server exactly as the Docker image does:
// server.js + .next/static + public, from .next/standalone.
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}

cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });

const portFlag = process.argv.indexOf("--port");
if (portFlag !== -1 && process.argv[portFlag + 1]) process.env.PORT = process.argv[portFlag + 1];
process.env.HOSTNAME ??= "127.0.0.1";

process.chdir(standalone);
await import(pathToFileURL(join(standalone, "server.js")).href);

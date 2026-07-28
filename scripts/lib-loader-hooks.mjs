// Resolver hooks registered by lib-loader.mjs. See that file for why.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const EXTS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs", ".json"];
const INDEXES = EXTS.map((e) => "index" + e);

/** Turn a filesystem path (possibly extensionless / a directory) into a real file. */
function resolveFile(fp) {
  if (existsSync(fp) && statSync(fp).isFile()) return fp;
  for (const e of EXTS) if (existsSync(fp + e)) return fp + e;
  if (existsSync(fp) && statSync(fp).isDirectory()) {
    for (const idx of INDEXES) {
      const p = path.join(fp, idx);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1. tsconfig alias: `@/lib/foo` → <root>/lib/foo
  if (specifier.startsWith("@/")) {
    const hit = resolveFile(path.join(ROOT, specifier.slice(2)));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  // 2. extensionless relative import from a known parent → add extension / index
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const hit = resolveFile(path.resolve(parentDir, specifier));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  // Everything else (bare packages, node: builtins, already-valid URLs) → default.
  return nextResolve(specifier, context);
}

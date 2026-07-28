// ESM resolve hook so plain `node` can run scripts that import the app's
// library graph. The codebase resolves modules the way the bundler / vitest do
// — via the `@/*` → `./*` tsconfig alias and extensionless imports — which raw
// Node does not honour. This hook fills both gaps:
//   1. rewrites `@/x` → <projectRoot>/x
//   2. adds `.ts`/`.tsx`/`/index.ts` (etc.) to extensionless local specifiers
// Node 24 strips the TypeScript types natively, so no transpiler is needed.
//
// Usage:  node --import ./scripts/lib-loader.mjs scripts/<name>.mts
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./lib-loader-hooks.mjs", pathToFileURL(import.meta.dirname + "/"));

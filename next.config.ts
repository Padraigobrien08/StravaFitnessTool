import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack's workspace root to THIS directory. Without this, Next walks
// up the tree, finds a stray lockfile in the home folder, and treats all of
// ~/ as the project — its file-watcher then indexes the entire home directory
// and consumes enormous amounts of memory. See README "Troubleshooting".
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/api/auth/strava",
        destination: "/api/auth/strava/authorize",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

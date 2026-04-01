import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Turbopack picks the nearest lockfile as workspace root; a package-lock.json
// higher in the tree (e.g. $HOME) makes resolution run from the wrong folder
// and fail on deps like tailwindcss. Pin root to this app.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/constructor",
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;

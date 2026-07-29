import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@separation/engine",
    "@separation/schemas",
    "@separation/lead-scoring",
    "@separation/marketplace",
    "@separation/ui",
  ],
};

export default nextConfig;

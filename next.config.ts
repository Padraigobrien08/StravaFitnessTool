import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

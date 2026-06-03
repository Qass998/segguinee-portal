import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  staticPageGenerationTimeout: 120,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;

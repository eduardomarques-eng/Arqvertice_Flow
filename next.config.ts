import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Otimização de compilação e isolamento de I/O
  reactStrictMode: false,
};

export default nextConfig;

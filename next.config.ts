import type { NextConfig } from "next";
import path from "node:path";

function resolveBuildId(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "arqvertice-v1"
  );
}

const BUILD_ID = resolveBuildId();

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    APP_BUILD_ID: BUILD_ID,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;

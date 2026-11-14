import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function resolveBuildId(): string {
  if (process.env.VERCEL_DEPLOYMENT_ID) return process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  const markerPath = path.resolve(__dirname, ".next-custom-build-id");
  const isBuildPhase = process.argv.some((arg) => arg === "build");
  if (isBuildPhase) {
    const id = `build-${Date.now()}`;
    try {
      fs.writeFileSync(markerPath, id, "utf8");
    } catch {
      // ignora ambiente somente leitura
    }
    return id;
  }
  try {
    if (fs.existsSync(markerPath)) {
      return fs.readFileSync(markerPath, "utf8").trim();
    }
  } catch {
    // fallback seguro
  }
  return "dev-build";
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

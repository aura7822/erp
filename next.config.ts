import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "postgres", "xlsx"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }, // spreadsheets + photos
    optimizePackageImports: ["react-icons/lu"],
  },
};
export default config;

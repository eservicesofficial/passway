import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hostinger uses the standard Next.js production server (`next start`).
  // Keep the same build-tolerance behavior as the known-working Escloud setup.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

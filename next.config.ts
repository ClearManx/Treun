import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the dev-mode "compiling" badge in the bottom-left corner (it shows in demos).
  devIndicators: false,
};

export default nextConfig;

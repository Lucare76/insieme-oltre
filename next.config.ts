import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/associazione/ricevute": ["./lib/receipt-assets/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;

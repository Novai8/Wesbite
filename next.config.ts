import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async headers() {
    return [
      {
        // The supplied cart OBJ is large and versioned by filename. Serve it
        // immutably so repeat visits never re-download it, and correct the
        // MIME type Next guesses for `.obj` (application/x-tgif).
        source: "/models/fyndra-cart/shopping-cart.obj",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.aliexpress-media.com" },
      { protocol: "https", hostname: "**.aliexpress.com" },
      { protocol: "https", hostname: "**.alicdn.com" },
    ],
  },
};

export default nextConfig;

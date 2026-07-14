import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Chỉ copy file thực sự cần thiết vào .next/standalone — giảm mạnh kích thước
  // Docker image (không cần cài lại node_modules đầy đủ khi deploy).
  output: "standalone",
  // Monorepo: trace từ root để .next/standalone gồm cả @zunibee/shared (packages/shared).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    // Bật forbidden()/unauthorized() để render app/forbidden.tsx và app/unauthorized.tsx
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

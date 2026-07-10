import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bật forbidden()/unauthorized() để render app/forbidden.tsx và app/unauthorized.tsx
    authInterrupts: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for PWA compatibility
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rsskuxuzgawjiclayoqf.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;

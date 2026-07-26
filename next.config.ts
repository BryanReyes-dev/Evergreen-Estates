import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vcsotaclvwvbpqiljkuk.supabase.co",
      },
    ],
  },

  serverExternalPackages: [],
  turbopack: {},
};

export default nextConfig;

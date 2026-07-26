import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  
  images: {
    
    unoptimized: true,
  
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vcsotaclvwvbpqiljkuk.supabase.co",
        pathname: "/storage/v1/object/public/**",
        
      },
    ],
  },

  serverExternalPackages: [],
  turbopack: {},
};

export default nextConfig;

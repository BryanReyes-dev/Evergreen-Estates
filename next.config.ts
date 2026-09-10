import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
 
  
  images: {
    
    unoptimized: false,
  
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vcsotaclvwvbpqiljkuk.supabase.co",
        pathname: "/storage/v1/object/public/**",
        
      },
      {
        protocol: "https",
        hostname: "vcsotaclvwvbpqiljkuk.supabase.co",
        pathname: "/storage/v1/object/sign/**",
        
      },
    ],
  },

  serverExternalPackages: [],
  turbopack: {
    root:  process.cwd()
  },
  
};

export default nextConfig;

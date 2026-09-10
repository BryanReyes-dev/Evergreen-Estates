import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    loader: 'custom',
    loaderFile: './src/lib/netlifyImageLoader.ts',
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
    root: process.cwd(),
  },
};

export default nextConfig;

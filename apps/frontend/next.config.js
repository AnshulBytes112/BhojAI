//@ts-check

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  // Basic Next.js configuration
  reactStrictMode: true,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3334/api',
  },
  
  // Output configuration
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  
  // Base path for deployment
  basePath: '',
  
  // Asset prefix for CDN (if needed)
  assetPrefix: '',
};

module.exports = nextConfig;

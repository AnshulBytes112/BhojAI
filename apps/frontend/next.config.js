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
  
  // Images configuration for Vercel
  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Trailing slashes for Cloudflare Pages
  trailingSlash: true,
};

module.exports = nextConfig;

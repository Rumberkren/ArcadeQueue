/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  // output: 'standalone',
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());

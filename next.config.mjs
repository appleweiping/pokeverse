/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Sprites & cries are loaded as plain <img>/<audio> from jsDelivr CDN mirrors
  // (works in regions where raw.githubusercontent.com is unreachable), so the
  // Next image optimizer is intentionally not used for them.
  images: { unoptimized: true },
};

export default nextConfig;

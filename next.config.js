/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  output: 'export',
  // Multi-route static export on GitHub Pages project subpaths: emit per-route
  // directory/index.html so deep-link refresh of /market and /mine resolves.
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;

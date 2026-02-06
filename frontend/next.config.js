/** @type {import('next').NextConfig} */
const nextConfig = {
  // Rewrites pour proxy vers l'API backend (évite les problèmes CORS en dev)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // destination: `${'http://dokktor-backend:3001'}/api/:path*`,
        destination: `${'http://161.97.107.23:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

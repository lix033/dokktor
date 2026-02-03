/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://161.97.107.23:3001/api/:path*',
        // destination: 'http://backend:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

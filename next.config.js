/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.DFL_STATIC_EXPORT === '1'
    ? { output: 'export' }
    : {}),
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

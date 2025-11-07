// Temporarily disabled workflow integration due to esbuild bundling issues during directive discovery
// import { withWorkflow } from 'workflow/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  serverExternalPackages: [
    'pdf-parse',
    'bcrypt-ts',
    'jose',
    '@panva/hkdf',
    'postgres',
    'drizzle-orm',
  ],
  transpilePackages: ['shiki'],
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  turbopack: {},
};

// Workflow integration disabled - workflow routes can still be manually triggered as regular API routes
export default nextConfig;
// export default withWorkflow(nextConfig);


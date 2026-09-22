import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // lib/wallet.ts (ethers + @smoothsend/sdk) is only ever imported server-side
  // (never from a 'use client' component), so none of demo-site's browser crypto
  // polyfills are needed. @smoothsend/sdk/avax must be external too: its compiled
  // bundle calls React.createContext() at module load (for its Provider), which
  // crashes under Next's RSC "react-server" build of React (no createContext there)
  // unless the package is required as a plain external instead of run through
  // Next's RSC bundler.
  serverExternalPackages: ['ethers', '@smoothsend/sdk'],
  // Pin the trace root to this project, not a stray lockfile elsewhere on disk.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

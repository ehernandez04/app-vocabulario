import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Sin esto, Turbopack sube buscando un lockfile y encuentra el pnpm-lock.yaml
  // de /Users/erick, fuera del repo. La raíz es este proyecto.
  turbopack: { root: __dirname },
};

export default nextConfig;

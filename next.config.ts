import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Sin esto, Turbopack sube buscando un lockfile y encuentra el pnpm-lock.yaml
  // de /Users/erick, fuera del repo. La raíz es este proyecto.
  turbopack: { root: __dirname },
};

// El service worker NO se construye acá: `@serwist/next` enganchado al bundler
// no funciona con Turbopack. Se arma aparte, con el CLI, después de next build
// (ver serwist.config.ts y el script `build`).
export default nextConfig;

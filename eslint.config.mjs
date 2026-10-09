import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // La app vieja tiene su propia configuración y se borra en #26; su dist/
    // son archivos minificados que no tiene sentido analizar.
    "legacy/**",
    // Código generado por Prisma.
    "lib/generated/**",
    // El service worker compilado, que genera el CLI de Serwist.
    "public/sw.js",
    "public/sw.js.map",
  ]),
]);

export default eslintConfig;

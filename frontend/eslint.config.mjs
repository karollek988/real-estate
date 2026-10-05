import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Flat config: ESLint 9 no longer reads .eslintrc.json, so `npm run lint`
// could not run at all. Same rule set as that file (next/core-web-vitals).
export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

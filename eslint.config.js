import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // MPULSE Rec #6 — block `import * as Icons from 'lucide-react'` style
      // imports so the bundler's tree-shake of named icon imports isn't
      // silently defeated. Named imports (`import { Search }`) stay fine.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value='lucide-react'] ImportNamespaceSpecifier",
          message: "Use named imports from 'lucide-react' (e.g. `import { Search } from 'lucide-react'`) so tree-shaking works.",
        },
      ],
    },
  },
);

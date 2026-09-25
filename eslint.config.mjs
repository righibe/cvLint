import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // Dot-folders (build output, tooling, local add-ons) are never app source.
    ignores: [".*/**", "out/**", "coverage/**", "public/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Security-sensitive patterns are banned outright.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "react/no-danger": "error",
      "react/jsx-no-script-url": "error",
      "react/jsx-no-target-blank": ["error", { allowReferrer: false, enforceDynamicLinks: "always" }],
      "no-restricted-properties": [
        "error",
        { object: "document", property: "write", message: "Never write raw HTML." },
        { property: "innerHTML", message: "Render text with React instead of HTML strings." },
        { property: "outerHTML", message: "Render text with React instead of HTML strings." },
        { property: "insertAdjacentHTML", message: "Render text with React instead of HTML strings." },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Tests feed javascript: URLs on purpose to prove they are neutralized.
    files: ["tests/**"],
    rules: { "no-script-url": "off" },
  },
];

export default config;

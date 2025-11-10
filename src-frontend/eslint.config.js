// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

// Hilfsfunktion: immer als Array behandeln
const asArray = (v) => (Array.isArray(v) ? v : [v]);

export default defineConfig([
  // Basis JS (scoped)
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".dev-server/**",
      "src-frontend/dist/**",
      "public/**"
    ]
  },

  // React NUR für JS/JSX (configs.flat.recommended kann ein Array sein)
  ...asArray(react.configs?.flat?.recommended).map((cfg) => ({
    ...cfg,
    files: ["**/*.{js,jsx}"],
    settings: { react: { version: "detect" }, ...(cfg?.settings || {}) },
  })),

  // JSON (liefert oft Array)
  ...asArray(json.configs?.recommended).map((cfg) => ({
    ...cfg,
    files: ["**/*.json"],
  })),

  // Markdown (liefert Array; wenn du README.md NICHT linten willst, nimm das raus
  // und packe **/*.md in .eslintignore)
  ...asArray(markdown.configs?.recommended).map((cfg) => ({
    ...cfg,
    files: ["**/*.md"],
  })),

  // CSS
  ...asArray(css.configs?.recommended).map((cfg) => ({
    ...cfg,
    files: ["**/*.css"],
  })),
  {
    rules: {
      // von "error" auf "warn" setzen
      "no-unused-vars": "warn",
    },
  },
]);

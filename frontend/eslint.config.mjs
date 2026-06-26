import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// Setup directory paths for FlatCompat
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize the legacy translator
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // 1. Spread the translated Next.js core web vitals config
  ...compat.extends('next/core-web-vitals'),

  // 2. Add your custom project rules as a separate object
  {
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

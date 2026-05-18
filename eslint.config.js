/**
 * eslint.config.js — flat config (ESLint v9+).
 *
 * Lightweight rule set focused on real bugs, not style (Prettier handles
 * formatting). Jest plugin is scoped to the `tests/` folder.
 */

const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const jestPlugin = require('eslint-plugin-jest');

module.exports = [
  { ignores: ['node_modules/', 'coverage/', 'dist/', 'uploads/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.js'],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: {
        ...jestPlugin.environments.globals.globals,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      'no-console': 'off',
    },
  },
  prettier,
];

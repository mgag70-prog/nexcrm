import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/'] },

  // App code — browser environment
  {
    files: ['src/**/*.{js,jsx}', 'vite.config.js'],
    ...js.configs.recommended,
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      // Vite uses the automatic JSX runtime — React need not be in scope
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'react/prop-types': 'off',
      'no-unused-vars': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Compiler-derived rules: refactor material for the Phase 3 App.jsx
      // split, not bugs to block on — demoted to warnings (triage 2026-08-11)
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // Cosmetic (apostrophes in JSX text), 43 false-alarm errors
      'react/no-unescaped-entities': 'off',
    },
  },

  // Netlify Functions — Node environment
  {
    files: ['netlify/functions/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'error',
      'no-unused-vars': 'warn',
    },
  },
]

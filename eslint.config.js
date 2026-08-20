import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // ESLint 10 ya no lee el fichero .eslintignore: las exclusiones tienen que
  // vivir aqui. Mientras estuvieron alli sin efecto, "npm run lint" analizaba
  // tambien los scripts sueltos de la raiz y devolvia ~538 errores, con lo que
  // el resultado era inservible y nadie lo miraba.
  globalIgnores([
    'dist',
    '.vercel',            // bundle ya compilado y minificado: no es codigo fuente
    'archivo',            // copias antiguas de App.jsx, fuera del arbol de fuentes
    'node_modules',
    // Scripts de un solo uso que se fueron dejando en la raiz durante las
    // migraciones (parches a App.jsx, lectores de Excel, comprobadores de
    // llaves...). No forman parte de la app.
    '*.cjs',
    'read_excel.js',
    'app_jsx_dump.jsx',
    'App_*.jsx',
    'test_*.jsx',
  ]),

  // Codigo de la aplicacion (navegador).
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Tests: corren en jsdom pero usan APIs de Node (global, process).
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Scripts de Node reales (el backup diario). Se analizan, pero con los
  // globales de Node, no los del navegador.
  {
    files: ['scripts/**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
])

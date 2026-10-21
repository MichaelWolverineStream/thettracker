import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // src/legacy is frozen (hash-checked by scripts/legacy-baseline.mjs); its findings can't be fixed.
  globalIgnores(['dist', 'test-results', 'playwright-report', '_tmp', 'src/legacy']),
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Forwarding an unknown rejection reason is fine; literals are still rejected.
      '@typescript-eslint/prefer-promise-reject-errors': ['error', { allowThrowingUnknown: true }],
    },
  },
  { files: ['src/**/*.tsx'], extends: [reactRefresh.configs.vite] },
  { files: ['tests/**/*.{ts,tsx}', '*.config.ts'], languageOptions: { globals: globals.node } },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      // async act() callbacks and async mock methods are intentional.
      '@typescript-eslint/require-await': 'off',
      // expect(mock.method) is the Vitest idiom.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  { files: ['**/*.{js,cjs,mjs}'], extends: [js.configs.recommended], languageOptions: { globals: globals.node } },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
])

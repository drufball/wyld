import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const config = [
  {
    ignores: ['**/.tsc/**', '**/dist/**', '**/node_modules/**', '.factory/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Default exports are forbidden; use named exports instead.',
        },
      ],
    },
  },
  eslintConfigPrettier,
];

export { config as default };

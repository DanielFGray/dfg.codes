const extensions = ['.ts', '.tsx', '.js', '.jsx']
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: [
    // 'import',
    'jsx-a11y',
    'react',
    'react-hooks',
    '@typescript-eslint',
    '@next/eslint-plugin-next',
  ],
  extends: [
    'eslint:recommended',
    // 'plugin:import/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    // 'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@next/eslint-plugin-next/recommended',
  ],
  env: {
    node: true,
    browser: true,
  },
  settings: {
    react: {
      pragma: 'React',
      version: 'detect',
    },
    'import/extensions': extensions,
    'import/parsers': {
      '@typescript-eslint/parser': extensions,
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: false,
        project: 'tsconfig.json',
      },
    },
  },
  parserOptions: {
    project: 'tsconfig.json',
  },
  rules: {
    semi: ['error', 'never'],
    indent: ['error', 2, { flatTernaryExpressions: true }],
    'no-unexpected-multiline': 'error',
    'no-nested-ternary': 'off',
    'no-unused-vars': 'off',
    'arrow-parens': ['error', 'as-needed'],
    'space-unary-ops': ['error', { overrides: { '!': true } }],
    'object-curly-newline': 'off',
    'react/jsx-props-no-spreading': 'off',
    'valid-jsdoc': 'warn',
    'react/jsx-filename-extension': ['error', { extensions: ['.tsx', '.jsx'] }],
    'react/prop-types': 'off',
    'jsx-a11y/anchor-is-valid': [
      'error',
      {
        components: ['Link'],
        specialLink: ['hrefLeft', 'hrefRight'],
        aspects: ['invalidHref', 'preferButton'],
      },
    ],
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/require-await': 'warn',
    // 'import/extensions': [ 'error', 'ignorePackages', {
    //   ts: 'never',
    //   tsx: 'never',
    //   js: 'never',
    //   jsx: 'never',
    // }],
  },
}

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-html/astro'],
  rules: {
    // tokens.css groups its custom properties with blank lines.
    'custom-property-empty-line-before': null,
    // Class names follow block__element--modifier.
    'selector-class-pattern': null,
    // Colours live in src/styles/tokens.css only. Everything else uses var(--token).
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'color',
      'color-mix',
      'light-dark',
    ],
  },
  overrides: [
    {
      files: ['src/styles/tokens.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        'function-disallowed-list': null,
      },
    },
  ],
};

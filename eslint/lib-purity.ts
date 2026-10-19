import type { Linter } from 'eslint';

const clock = 'src/lib is pure: take the date as an argument.';
const io = 'src/lib is pure: do I/O at the edge and pass the result in.';

/**
 * The rules that keep a folder pure: no clock, no files, no network, no process state.
 * The real config applies them to src/lib; the lint test applies the same rules to a fixture.
 */
export function libPurity(files: string[]): Linter.Config {
  return {
    files,
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: io },
        { name: 'process', message: io },
        { name: 'performance', message: clock },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: clock },
        { object: 'Math', property: 'random', message: 'src/lib is pure: pass randomness in.' },
        { object: 'globalThis', property: 'fetch', message: io },
        { object: 'globalThis', property: 'process', message: io },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: clock,
        },
        { selector: "CallExpression[callee.name='Date']", message: clock },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'fs/*',
                'child_process',
                'http',
                'https',
                'net',
                'os',
                'process',
              ],
              message: io,
            },
          ],
        },
      ],
    },
  };
}

import config from './es5.js';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs'

config.input = 'tests/performance.ts';
config.output.file = 'tests/performance.js';
config.plugins.push(
    nodeResolve({
        mainFields: ["jsnext", "main"],
    }),
);
config.plugins.push(
    commonjs({
        include: 'node_modules/**',
        namedExports: {
            'node_modules/knuth-shuffle-seeded/index.js': [ 'shuffle' ],
        }
    }),
);

export default config;

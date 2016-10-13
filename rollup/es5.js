import config from './es2015.js';
import babel from 'rollup-plugin-babel';

config.entry = 'src/main.es5.ts';
config.dest = 'dist/chunked-dc.es5.js';
config.format = 'iife';
config.moduleName = 'chunkedDc';
config.useStrict = true;
config.plugins.push(
    babel({
        babelrc: false,
        exclude: 'node_modules/**',
        presets: [
            // Use ES2015 but don't transpile modules since Rollup does that
            ['es2015', {modules: false}]
        ],
        plugins: ['external-helpers']
    })
)

export default config;

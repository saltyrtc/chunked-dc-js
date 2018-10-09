import config from './es2015.js';
import babel from 'rollup-plugin-babel';

config.output.file = 'dist/chunked-dc.es5.js';
config.output.format = 'iife';
config.output.name = 'chunkedDc';
config.output.strict = true;
config.plugins.push(
    babel({
        babelrc: false,
        exclude: 'node_modules/**',
        extensions: ['.js', '.ts'],
        externalHelpers: true,
        presets: [
            ['@babel/preset-env', {
                modules: false,
                forceAllTransforms: true,
            }]
        ],
    })
)

export default config;

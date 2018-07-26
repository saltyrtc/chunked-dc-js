import typescript from 'rollup-plugin-typescript';
import fs from 'fs';

let p = JSON.parse(fs.readFileSync('package.json'));

export default {
    input: 'src/main.ts',
    plugins: [
        typescript({
            typescript: require('typescript')
        })
    ],
    output: {
        file: 'dist/chunked-dc.es2015.js',
        format: 'es',
        sourcemap: true,
        banner: "/**\n" +
                " * chunked-dc v" + p.version + "\n" +
                " * " + p.description + "\n" +
                " * " + p.homepage + "\n" +
                " *\n" +
                " * Copyright (C) 2016-2018 " + p.author + "\n" +
                " *\n" +
                " * Licensed under the Apache License, Version 2.0, <see LICENSE-APACHE file>\n" +
                " * or the MIT license <see LICENSE-MIT file>, at your option. This file may not be\n" +
                " * copied, modified, or distributed except according to those terms.\n" +
                " */\n"
    },
}

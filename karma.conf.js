module.exports = function(config) {
    config.set({
        frameworks: ['jasmine'],
        files: [
            'chunked-dc.js',
            'tests/tests.js'
        ],
        browsers: ['Firefox']
    });
}

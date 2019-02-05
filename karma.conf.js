module.exports = function(config) {
    config.set({
        frameworks: ['jasmine'],
        files: [
            'chunked-dc.js',
            'tests/tests.js',
            'tests/performance.js',
        ],
        browsers: ['Firefox'],
        browserDisconnectTimeout: 10000,
    });
};

module.exports = function (options) {
    return {
        ...options,
        externals: [
            ...(options.externals || []),
            // These are optional peer deps of @mapbox/node-pre-gyp (used by bcrypt)
            // They don't exist in production and cause webpack build failures
            function ({ request }, callback) {
                if (/^(aws-sdk|mock-aws-s3|nock)$/.test(request)) {
                    return callback(null, 'commonjs ' + request);
                }
                callback();
            },
        ],
    };
};

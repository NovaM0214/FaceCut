const { override } = require('customize-cra');

module.exports = override(
  (config) => {
    // 解决face-api.js的fs模块依赖问题
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        fs: false
      }
    };
    return config;
  }
);
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'public/prism-themes'),
          to: path.resolve(__dirname, 'dist/prism-themes'),
        },
      ],
    }),
  ],
};

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { RuntimeGlobals } = require('webpack');
const { userInfo } = require('os');
const { split } = require('lodash');

module.exports = {
  mode: 'development',
  entry: './src/js/index.js',
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean:true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        include: [
          path.resolve(__dirname, 'node_modules/mermaid/'),
          path.resolve(__dirname, 'node_modules/monaco-editor'),
          path.resolve(__dirname, 'node_modules/highlight.js/styles'),
          path.resolve(__dirname, 'node_modules/prismjs/themes'),
          path.resolve(__dirname, 'node_modules/prism-themes/themes'),
        ],
        use: [
          'style-loader',
          'css-loader'
        ],
      },
      {
        test: /\.scss$/,
        include: path.resolve(__dirname, 'src/styles'),
        use: [
          'style-loader',
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.svg$/,
        include: path.resolve(__dirname, 'src/assets'),
        type: 'asset/inline', // Inline SVG as data URL
      },
    ],
  },
  plugins: [
    new CompressionPlugin(),
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new MonacoWebpackPlugin({
      languages: ['markdown'], //, 'javascript', 'typescript', 'json'],
      publicPath: '/',
    }),
  ],
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist'),
      publicPath: '/',
    },
    historyApiFallback: true,
    open: true,
    port: 8080
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    }
  },
};
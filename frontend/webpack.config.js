const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
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
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ],
      },
      {
        test: /\.scss$/,
        include: path.resolve(__dirname, 'src/styles'),
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.svg$/,
        include: path.resolve(__dirname, 'src/assets'),
        type: 'asset/inline', // Inline SVG as data URL
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new CompressionPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[id].[contenthash].css',
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new MonacoWebpackPlugin({
      languages: ['markdown'], //, 'javascript', 'typescript', 'json'],
      publicPath: '/',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public/prism-themes',
          to: 'prism-themes',
        },
      ],
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
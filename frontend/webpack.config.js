const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { RuntimeGlobals, experiments } = require('webpack');
const { userInfo } = require('os');
const { split, min } = require('lodash');


module.exports = {
  cache: {
    type: 'filesystem',
  },
  mode: 'development',
  devtool: 'source-map',
  entry: './src/index.js',
  output: {
    filename: '[name].bundle.js',
    path: (() => {
      const os = require('os');
      const fs = require('fs');
      const home = os.homedir();
      const ramcache = path.join(home, 'ramcache');
      const target = path.join(ramcache, 'markdown-manager', 'dist');
      try {
        if (fs.existsSync(ramcache)) {
          const mmDir = path.join(ramcache, 'markdown-manager');
          if (!fs.existsSync(mmDir)) {
            fs.mkdirSync(mmDir, { recursive: true });
          }
          return target;
        }
      } catch (e) {
        // fallback
      }
      return path.resolve(__dirname, 'dist');
    })(),
    clean: true,
    publicPath: '/',
  },
  module: {
    rules: [
      // Load Hunspell dictionary files as raw text
      {
        test: /\.(aff|dic)$/,
        type: 'asset/source',
      },
      {
        test: /\.ico$/,
        type: 'asset/resource',
      },
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: '[name].[contenthash].worker.js',
            chunkFilename: '[name].[contenthash].worker.js',
            esModule: true,
          }
        }
      },
      {
        test: /\.(js|jsx)$/,
        exclude: [/node_modules/, /\.worker\.js$/],
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react'
            ]
          }
        }
      },
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
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.tsx', '.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    fallback: {
      fs: false,
      os: false,
      http: false,
      https: false,
      crypto: false,
      stream: false,
      zlib: false,
      vm: false,
      url: false,
      module: false,
      querystring: false,
    },
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
        {
          from: 'src/assets/favicon.ico',
          to: 'favicon.ico',
        },
        // Copy hunspell dictionary files for spell checker
        {
          from: require.resolve('dictionary-en-us/index.aff'),
          to: 'dictionary/index.aff',
        },
        {
          from: require.resolve('dictionary-en-us/index.dic'),
          to: 'dictionary/index.dic',
        },
      ],
    }),
  ],
  devServer: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    },
    static: [
      {
        directory: path.resolve(__dirname, 'public'),
        publicPath: '/',
      },
    ],
    historyApiFallback: true,
    open: false,
    port: 3000,
    watchFiles: ['src/**/*', 'public/**/*'],
    // watchFiles: {
    //   paths: ['src/**/*', 'public/**/*'],
    //   options: {
    //     usePolling: true, // Use polling to detect changes
    //     interval: 1000, // Check for changes every second
    //     ignored: /node_modules/,
    //   },
    // }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
    minimize: false,
  },
};
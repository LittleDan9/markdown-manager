const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { RuntimeGlobals, experiments } = require('webpack');
const { EsbuildPlugin } = require('esbuild-loader');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--mode=production');
const isDevelopment = !isProduction;

console.log(`🔧 Webpack building in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

module.exports = {
  // 1) Enable filesystem cache for ALL modes (including production)
  cache: isDevelopment ? {
    type: 'memory', // Use memory cache for development to avoid permission issues
  } : {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename], // Invalidate cache when webpack config changes
    },
  },
  mode: isProduction ? 'production' : 'development',
  // 4) Change prod devtool to false, faster sourcemaps for dev
  devtool: isProduction ? false : 'eval',
  experiments: {
    lazyCompilation: isDevelopment,
    cacheUnaffected: true,
  },
  entry: './src/index.js',
  output: {
    filename: '[name]..[contenthash].bundle.js',
    chunkFilename: '[name].[contenthash].chunk.js',
    assetModuleFilename: '[name].[contenthash][ext]',
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
        exclude: [/node_modules/],
        use: {
          loader: 'worker-loader',
          options: {
            filename: '[name].[contenthash].worker.js',
            chunkFilename: '[name].[contenthash].worker.js',
            publicPath: '/',
            esModule: true,
            inline: 'no-fallback', // This prevents blob URLs and creates actual files
          }
        }
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',          // handles .ts/.tsx/.js/.jsx correctly by extension
          target: 'es2019',       // modern target = less work
        }
      },
      {
        test: /\.css$/,
        use: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader'
        ],
      },
      {
        test: /\.scss$/,
        include: path.resolve(__dirname, 'src/styles'),
        use: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
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
        test: /\.svg$/,
        include: path.resolve(__dirname, 'node_modules/aws-icons'),
        type: 'asset/source', // Import SVG content as string
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
    // Optimize resolution performance
    modules: ['node_modules'],
    fallback: {
      // Prevent webpack from trying to polyfill node modules
      "fs": false,
      "path": false,
      "crypto": false,
    },
  },
  externals: {
    // Exclude heavy libraries that can be loaded dynamically
    // This prevents them from being bundled in the main chunks
  },
  plugins: [
    ...(isProduction ? [new CompressionPlugin()] : []),
    ...(isProduction ? [new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[id].[contenthash].css',
    })] : []),
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    ...(isProduction ? [new MonacoWebpackPlugin({
      languages: ['markdown'], // Only include markdown language
      features: [
        // Minimal features to reduce bundle size significantly
        'find',
        'clipboard',
        'contextmenu'
      ],
      publicPath: '/',
      globalAPI: false, // Don't expose global monaco API
    })] : []),
    ...(isDevelopment ? [new ReactRefreshWebpackPlugin({
      overlay: false, // Disable error overlay since we have our own
    })] : []),
    ...(isProduction ? [new CopyWebpackPlugin({
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
    })] : []),
  ].filter(Boolean),
  // Development server (only for development)
  ...(isDevelopment && {
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
      // Optimize for faster development
      hot: true, // Enable HMR
      liveReload: false, // Disable to use HMR instead
      watchFiles: {
        paths: ['src/**/*'],
        options: {
          usePolling: false, // Use native file watching (faster)
          ignoreInitial: true,
          ignored: /node_modules/,
        },
      },
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
        progress: false, // Disable progress overlay for faster builds
      },
      // Reduce memory usage
      devMiddleware: {
        writeToDisk: false, // Keep in memory
        stats: 'errors-warnings', // Minimal output
      },
    },
  }),
  optimization: isProduction ? {
    // Production optimizations - proper chunking for performance
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 10,
      maxAsyncRequests: 15,
      minSize: 100000, // 100KB minimum
      maxSize: 1000000, // 1MB maximum chunks
      cacheGroups: {
        // Critical React/Bootstrap - load immediately
        critical: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|react-bootstrap|bootstrap)[\\/]/,
          name: 'critical-vendors',
          chunks: 'initial',
          priority: 50,
          enforce: true,
        },
        // Monaco Editor - lazy load
        monaco: {
          test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
          name: 'monaco-editor',
          chunks: 'async',
          priority: 40,
          enforce: true,
        },
        // Mermaid - lazy load
        mermaid: {
          test: /[\\/]node_modules[\\/](mermaid|cytoscape|d3|dagre|@mermaid-js)[\\/]/,
          name: 'mermaid-libs',
          chunks: 'async',
          priority: 35,
          enforce: true,
        },
        // Icons - lazy load
        icons: {
          test: /[\\/]node_modules[\\/](@iconify|aws-icons)[\\/]/,
          name: 'icon-packs',
          chunks: 'async',
          priority: 30,
          enforce: true,
        },
        // Other vendors
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'initial',
          priority: 10,
          minChunks: 2,
        },
      },
    },
    minimizer: [
      new EsbuildPlugin({
        target: 'es2019',
        css: true,
        legalComments: 'none',
      }),
    ],
    minimize: true,
    usedExports: true,
    sideEffects: false,
  } : {
    // Development optimizations - fast builds
    splitChunks: false,
    minimize: false,
    usedExports: false,
    sideEffects: false,
    removeAvailableModules: false,
    removeEmptyChunks: false,
    concatenateModules: false,
  },
  // Reduce log verbosity for development builds
  stats: isDevelopment ? {
    preset: 'errors-warnings',
    colors: true,
    timings: true,
    builtAt: false,
    children: false,
    modules: false,
    entrypoints: false,
    chunks: false,
    chunkModules: false,
    assets: false,
    version: false,
    hash: false,
  } : {
    // Production stats - more detailed
    preset: 'normal',
    colors: true,
    timings: true,
  },
  // Performance hints
  performance: isProduction ? {
    hints: 'warning',
    maxEntrypointSize: 1500000, // 1.5MB for production
    maxAssetSize: 800000, // 800KB per asset
    assetFilter: function(assetFilename) {
      return /\.(js|css)$/.test(assetFilename);
    }
  } : {
    // More lenient for development
    hints: false, // Disable performance hints in development
  },
};
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  entry: {
    main: './src/renderer/index.tsx',
    float: './src/renderer/float/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json',
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      chunks: ['main'],
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/float/index.html',
      filename: 'float.html',
      chunks: ['float'],
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: {
      rewrites: [
        { from: /^\/float/, to: '/float.html' },
        { from: /./, to: '/index.html' },
      ],
    },
    static: {
      directory: path.join(__dirname, 'dist/renderer'),
    },
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
};

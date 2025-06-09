/* eslint-disable no-shadow */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import CopyPlugin from 'copy-webpack-plugin';
import webpack from 'webpack'; // <-- Add this import

const require = createRequire(import.meta.url); 
const srcRoot = './src/';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function (env = {}) {
  return {
    entry: {
      TMViz: [srcRoot + 'TMViz.js'],
      main: srcRoot + 'main.js'
    },
    output: {
      path: path.resolve(__dirname, 'build'),
      publicPath: 'auto',
      clean: true,
      filename: '[name].bundle.js'
    },
    module : {
      rules : [
        {test: /\.css$/, use: ['style-loader', 'css-loader']}, 
        {test: /\.yaml$/, type: 'asset/source'}
      ]},
    resolve: {
      fallback: {
        buffer: require.resolve('buffer/') // 
      }
    },
    mode: env.NODE_ENV || 'development',
    devtool: (env.NODE_ENV == 'production') ? false : 'eval-source-map',
    devServer: {
      static: {
        directory: __dirname
      },
      open: true,
      hot: true,
      historyApiFallback: true,
      devMiddleware: {
        writeToDisk: true
      }
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'node_modules/ace-builds/src-min-noconflict/worker-*.js',
            to: 'build/[name][ext]'     
          }
        ]
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'] 
      })
    ]
  };
}

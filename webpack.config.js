/* eslint-disable no-shadow */
import path from 'path';
import { fileURLToPath } from 'url';

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
    }
  };
}
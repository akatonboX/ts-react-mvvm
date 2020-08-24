const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    path: path.join(__dirname, 'lib'),
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modeules/,
        use: [
          'ts-loader',
        ],
      },
      {
        test: /\.module\.(scss|sass)$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              injectType: "singletonStyleTag",
            },
          },
          {
            loader: 'css-loader',
          },
          {
            loader: 'postcss-loader',
            options: {
              plugins: (loader) => [
                require('autoprefixer')(),
              ],
            },
          },
          {
            loader: 'sass-loader',
          },
          
        ],
      }
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  externals: [
    {
      react: {
        root: 'React',
        commonjs2: 'react',
        commonjs: 'react',
        amd: 'react'
      },
      'react-dom': {
        root: 'ReactDom',
        commonjs2: 'react-dom',
        commonjs: 'react-dom',
        amd: 'react-dom'
      }
    }
  ]
}
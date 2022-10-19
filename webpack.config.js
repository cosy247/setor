const ESLintWebpackPlugin = require("eslint-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
  entry: "./test/src/main.js",
  output: {
    path: path.resolve(__dirname, "test/build"),
    filename: "js/main.js",
    clean: true
  },
  module: {
    rules : [
      {
        test:/\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {
        test:/\.less$/,
        use: ["style-loader", "css-loader","less-loader"]
      },
      {
        test:/\.s[ac]ss$/,
        use: ["style-loader", "css-loader","less-loader"]
      },
      {
        test:/\.styl$/,
        use: ["style-loader", "css-loader","stylus-loader"]
      },
      {
        test: /\.(jpe?g|png|gif|webp|svg)$/,
        type: "asset",
        parser:{
          dataUrlCondition: {
            maxSize: 10 * 1024
          }
        },
        generator:{
          filename:"media/[hash:10][ext][query]",
        }
      },
      {
        test: /\.(ttf|woff2|mp3|mp4|avi)$/,
        type: "asset/resourse",
        generator:{
          filename:"media/[hash:10][ext][query]",
        }
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      }
    ]
  },
  plugins: [
    new ESLintWebpackPlugin({
      context: path.resolve(__dirname, "./test")
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "./test/public/index.html")
    })
  ],
  devServer:{
    host:"localhost",
    port:"3000",
    open:true,
    watchFiles:["./test/public","./test/src"]
  },
  mode: "development"
}
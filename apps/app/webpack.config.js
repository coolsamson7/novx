const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;
const path = require("path");

const foundationShared = {
  "@novx/portal": { singleton: true, eager: true, requiredVersion: false },
  "@novx/core": { singleton: true, eager: true, requiredVersion: false },
  "@novx/communication": { singleton: true, eager: true, requiredVersion: false },
  "@novx/i18n": { singleton: true, eager: true, requiredVersion: false },
};

module.exports = {
  entry: "./apps/app/src/main.tsx",
  mode: "development",
  devtool: "source-map",

  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "/",
    clean: true,
    filename: "[name].[contenthash].js",
  },

  
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@novx/portal": path.resolve(__dirname, "../../libs/portal/src"),
      "@novx/core": path.resolve(__dirname, "../../libs/core/src"),
      "@novx/i18n": path.resolve(__dirname, "../../libs/i18n/src"),
      "@novx/communication": path.resolve(__dirname, "../../libs/communication/src"),
    },
  },

  module: {
    rules: [
      {
        oneOf: [
          // ✅ SVGs → raw source (for sprite system)
          {
            test: /\.svg$/,
            type: "asset/source",
          },

        // ✅ TS/TSX in showcases → raw text
{
  test: /\.(tsx?|ts|txt|css|json)$/, // add any other extensions you want as raw
  resourceQuery: /raw/,               // only imports with '?raw'
  type: 'asset/source',               // returns raw string
},
          // ✅ TS / TSX
          {
            test: /\.tsx?$/,
            loader: "ts-loader",
            options: {
                transpileOnly: false,
                compilerOptions: {
                    sourceMap: true,
                    inlineSourceMap: false
                }
             },
            exclude: /node_modules/,
          },
        ],
      },
    ],
  },

  experiments: {
    topLevelAwait: true,
  },

  plugins: [
    new ModuleFederationPlugin({
      name: "app",
      filename: "remoteEntry.js",

      remotes: {
        microfrontend:
          "microfrontend@http://localhost:3001/remoteEntry.js",
      },

      shared: {
        "reflect-metadata": { singleton: true, eager: true },
        react: { singleton: true, eager: true, requiredVersion: false },
        "react-dom": { singleton: true, eager: true, requiredVersion: false },
        "react-router-dom": { singleton: true, eager: true, requiredVersion: false },
        "react/jsx-runtime": { singleton: true, eager: true, requiredVersion: false },

        ...foundationShared,
      },
    }),

    new HtmlWebpackPlugin({
      template: "apps/app/index.html",
    }),
  ],

  devServer: {
    port: 3000,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, "public"),
    },
    headers: { "Access-Control-Allow-Origin": "*" },
    hot: true,
    allowedHosts: "all",
  },
};

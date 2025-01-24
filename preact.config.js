export default {
  webpack(config, env, helpers, options) {
    if (env.production) {
      config.output.publicPath = "/dianamoyaosorio.github.io/"
    }
  },
  plugins: [
    (config) => {
      if (config.devServer) {
        config.devServer.historyApiFallback = {
          index: "/index.html",
          disableDotRule: true,
        }
      }
    },
  ],
}







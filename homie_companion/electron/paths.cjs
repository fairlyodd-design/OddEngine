const path = require("node:path");

function isDev() {
  return !process.env.APP_IS_PACKAGED && !require("electron").app.isPackaged;
}

function rendererUrl() {
  return process.env.HOMIE_RENDERER_URL || "http://127.0.0.1:5187";
}

function rendererFile() {
  return path.join(__dirname, "..", "dist", "index.html");
}

module.exports = {
  isDev,
  rendererUrl,
  rendererFile
};

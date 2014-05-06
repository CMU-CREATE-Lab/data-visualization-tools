dojoConfig = {
  isDebug: true,
  async: true,
  baseUrl: app.paths.lib.concat(['dojo-release-1.9.3', 'dojo', '']).join('/'),
  packages: app.packages
};

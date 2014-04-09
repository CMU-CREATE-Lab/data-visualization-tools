$(document).ready(function () {
/*
  require.config({
    baseUrl: window.location.pathname.split("/").slice(0, -3).concat(["js"]).join("/"),
    paths: {
      "heatmap": window.location.pathname.split("/").slice(0, -1).concat(["js"]).join("/"),
    }
  });
*/

  require.config({
    baseUrl: window.location.pathname.split("/").slice(0, -1).join("/"),
  });

  require(["Visualization"], function (Visualization) {
    visualization = new Visualization();
  });
});

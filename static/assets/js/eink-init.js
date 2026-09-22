// E-Ink mode init (patch on the archie base). Runs blocking in <head> via
// params.customJS so the class + B&W palette apply before first paint.
(function () {
  "use strict";

  var root = document.documentElement;
  var search = window.location.search || "";

  // ?web=1 always wins and returns to normal web mode.
  if (/(?:^|[?&])web=1(?:&|$)/i.test(search)) {
    return;
  }

  var einkQuery = /(?:^|[?&])eink=(?:1|true|yes)(?:&|$)/i.test(search);
  var ua = navigator.userAgent || "";
  var einkUA = /Kindle|Silk|Kobo|reMarkable|EinkBro|Onyx|Boox/i.test(ua);

  if (!einkQuery && !einkUA) {
    return;
  }

  root.classList.add("eink");
  root.setAttribute("data-eink", "true");

  // Force archie's palette variables to black & white.
  var mono = {
    "--color-primary": "#000000",
    "--color-primary-dark": "#000000",
    "--color-primary-hover": "#000000",
    "--color-border": "#000000",
    "--color-border-dark": "#000000",
    "--color-text": "#000000",
    "--color-text-dark": "#000000",
    "--color-text-muted-dark": "#000000",
    "--color-text-meta": "#000000",
    "--color-background": "#ffffff",
    "--color-background-dark": "#ffffff",
    "--color-background-pre": "#ffffff",
    "--color-background-pre-dark": "#ffffff",
    "--color-background-code": "#ffffff",
    "--color-background-code-dark": "#ffffff",
    "--color-background-toc": "#ffffff",
    "--color-background-toc-dark": "#ffffff",
    "--color-background-draft": "#ffffff",
    "--color-background-draft-dark": "#ffffff",
    "--tui-accent": "#000000",
    "--tui-border": "#000000"
  };
  Object.keys(mono).forEach(function (name) {
    root.style.setProperty(name, mono[name]);
  });

  // Neutralize archie's dark stylesheet so E-Ink is always light B&W.
  // themetoggle.js runs later in the body and may re-enable it from localStorage.
  function lockLight() {
    var darkStyle = document.getElementById("darkModeStyle");
    if (darkStyle) darkStyle.disabled = true;
    root.setAttribute("data-theme", "light");
  }
  lockLight();
  document.addEventListener("DOMContentLoaded", lockLight);
})();

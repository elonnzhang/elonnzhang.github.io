(function () {
  "use strict";

  var root = document.documentElement;
  var button = document.getElementById("theme-toggle");
  var storageKey = "elonnzhang-theme";

  if (!button) {
    return;
  }

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function updateLabel(theme) {
    var nextTheme = theme === "dark" ? "light" : "dark";
    var label = nextTheme === "light" ? "切换到亮色模式" : "切换到暗色模式";
    var text = button.getElementsByClassName("theme-toggle__label")[0];

    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    if (text) {
      text.innerHTML = label;
    }
  }

  function setTheme(theme, persist) {
    var themeColor = document.getElementById("theme-color");

    root.setAttribute("data-theme", theme);
    if (themeColor) {
      themeColor.setAttribute("content", theme === "dark" ? "#111210" : "#f7f7f2");
    }
    updateLabel(theme);

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        // Theme switching still works when storage is unavailable.
      }
    }
  }

  updateLabel(currentTheme());

  if (button.addEventListener) {
    button.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  } else {
    button.onclick = function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true);
    };
  }
}());

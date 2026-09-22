// TUI patch: close the header dropdowns (space-switcher + mobile nav-menu) on
// outside click, scroll, or Escape. Both are <details>; the nav-menu is only a
// dropdown at mobile widths but sharing the logic is harmless when it's hidden.
(function () {
  var switchers = document.querySelectorAll(".space-switcher, .nav-menu");
  if (!switchers.length) return;

  function closeAll(except) {
    switchers.forEach(function (details) {
      if (details.open && details !== except) {
        details.open = false;
      }
    });
  }

  // Close when clicking outside an open dropdown.
  document.addEventListener("click", function (event) {
    switchers.forEach(function (details) {
      if (details.open && !details.contains(event.target)) {
        details.open = false;
      }
    });
  });

  // Only one open at a time.
  switchers.forEach(function (details) {
    details.addEventListener("toggle", function () {
      if (details.open) closeAll(details);
    });
  });

  // Close on scroll.
  window.addEventListener(
    "scroll",
    function () {
      closeAll(null);
    },
    { passive: true }
  );

  // Close on Escape.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeAll(null);
  });
})();

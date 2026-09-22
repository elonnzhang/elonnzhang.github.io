// TUI patch: open a mermaid diagram in a fullscreen overlay for closer inspection.
(function () {
  "use strict";

  var openOverlay = null;

  function close() {
    if (!openOverlay) return;
    openOverlay.remove();
    openOverlay = null;
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onKey);
  }

  function onKey(event) {
    if (event.key === "Escape") close();
  }

  function open(svg) {
    close();

    var overlay = document.createElement("div");
    overlay.className = "mermaid-overlay";

    var content = document.createElement("div");
    content.className = "mermaid-overlay__content";

    var clone = svg.cloneNode(true);
    // Let CSS size the clone to fill the viewport; the viewBox +
    // preserveAspectRatio scale the diagram to fit (up or down). mermaid's
    // inline width="100%" / max-width would otherwise pin it to a small size.
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.style.removeProperty("max-width");
    clone.style.removeProperty("max-height");
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
    content.appendChild(clone);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mermaid-overlay__close";
    closeBtn.setAttribute("aria-label", "关闭 / close");
    closeBtn.textContent = "✕";

    overlay.appendChild(closeBtn);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    openOverlay = overlay;

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);
  }

  document.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest(".mermaid-fullscreen");
    if (!btn) return;
    var figure = btn.closest(".mermaid-figure");
    var svg = figure && figure.querySelector(".mermaid svg");
    if (svg) open(svg);
  });
})();

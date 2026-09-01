(function () {
  "use strict";
  var root = document.documentElement;
  var gallery = document.querySelector("[data-gallery-grid]");
  var items = gallery ? Array.prototype.slice.call(gallery.querySelectorAll("[data-gallery-item]")) : [];
  var lightbox = document.querySelector("[data-gallery-lightbox]");
  var current = 0;
  var trigger = null;

  function layout() {
    if (!gallery || !items.length) return;
    if (window.innerWidth <= 700) { gallery.style.height = "auto"; items.forEach(function (item) { item.style.position = "relative"; }); return; }
    var rowHeight = 250, gap = 10, width = gallery.getBoundingClientRect().width, rows = [], row = [], ratio = 0;
    items.forEach(function (item) {
      var imageRatio = Number(item.dataset.galleryWidth) / Number(item.dataset.galleryHeight) || 1;
      row.push({ item: item, ratio: imageRatio }); ratio += imageRatio;
      if (ratio >= (width - gap * (row.length - 1)) / rowHeight || item === items[items.length - 1]) {
        rows.push({ boxes: row, height: Math.max(150, (width - gap * (row.length - 1)) / ratio) }); row = []; ratio = 0;
      }
    });
    var top = 0;
    rows.forEach(function (entry) {
      var left = 0;
      entry.boxes.forEach(function (box) { var itemWidth = entry.height * box.ratio; box.item.style.position = "absolute"; box.item.style.width = itemWidth + "px"; box.item.style.height = entry.height + "px"; box.item.style.left = left + "px"; box.item.style.top = top + "px"; left += itemWidth + gap; });
      top += entry.height + gap;
    });
    gallery.style.height = Math.max(0, top - gap) + "px";
  }
  function update(index) {
    var item = items[index], image = item.querySelector("img"); current = index;
    lightbox.querySelector("[data-gallery-lightbox-image]").src = image.src;
    lightbox.querySelector("[data-gallery-lightbox-image]").alt = item.dataset.galleryAlt;
    lightbox.querySelector("[data-gallery-lightbox-title]").textContent = item.dataset.galleryTitle;
    lightbox.querySelector("[data-gallery-lightbox-album]").textContent = item.dataset.galleryAlbum;
    lightbox.querySelector("[data-gallery-lightbox-category]").textContent = item.dataset.galleryCategory;
    lightbox.querySelector("[data-gallery-lightbox-count]").textContent = String(index + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
  }
  function open(index, source) { if (!lightbox || !items[index]) return; trigger = source; update(index); lightbox.hidden = false; root.classList.add("gallery-is-open"); var closeButton = lightbox.querySelector(".gallery-lightbox__close"); if (closeButton) closeButton.focus(); }
  function close() { if (!lightbox || lightbox.hidden) return; lightbox.hidden = true; root.classList.remove("gallery-is-open"); if (trigger && document.contains(trigger)) trigger.focus(); }
  function move(step) { update((current + step + items.length) % items.length); }
  if (gallery) { window.addEventListener("resize", layout); window.addEventListener("orientationchange", layout); layout(); gallery.addEventListener("click", function (event) { var item = event.target.closest && event.target.closest("[data-gallery-item]"); if (!item || root.getAttribute("data-gallery-eink") === "true") return; event.preventDefault(); open(items.indexOf(item), item); }); }
  if (lightbox) { lightbox.addEventListener("click", function (event) { if (event.target.closest && event.target.closest("[data-gallery-close]")) { close(); return; } if (event.target.closest && event.target.closest("[data-gallery-prev]")) { move(-1); return; } if (event.target.closest && event.target.closest("[data-gallery-next]")) move(1); }); document.addEventListener("keydown", function (event) { if (lightbox.hidden) return; if (event.key === "Escape") { event.preventDefault(); close(); } if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } if (event.key === "ArrowRight") { event.preventDefault(); move(1); } }); }
  var themeToggle = document.querySelector("[data-gallery-theme-toggle]");
  if (themeToggle) themeToggle.addEventListener("click", function () { var theme = root.getAttribute("data-gallery-theme") === "dark" ? "light" : "dark"; root.setAttribute("data-gallery-theme", theme); var meta = document.getElementById("gallery-theme-color"); if (meta) meta.setAttribute("content", theme === "dark" ? "#111210" : "#f7f7f2"); try { window.localStorage.setItem("elonnzhang-theme", theme); } catch (error) {} });
}());

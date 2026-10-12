(function () {
  "use strict";

  if (document.documentElement.getAttribute("data-eink") === "true") {
    return;
  }

  var progress = document.getElementById("reading-progress");
  var value = progress && progress.getElementsByClassName("reading-progress__value")[0];
  var label = progress && progress.getElementsByClassName("reading-progress__label")[0];
  var article = document.querySelector("[data-reading-progress]");
  var articleBody = article && article.getElementsByClassName("body")[0];
  var toc = document.getElementsByClassName("toc")[0];
  var tocToggle = toc && toc.getElementsByClassName("toc__toggle")[0];
  var tocContent = toc && toc.getElementsByClassName("toc__content")[0];
  var backToTop = document.getElementsByClassName("back-to-top")[0];
  var tocLinks = tocContent ? tocContent.querySelectorAll("a[href^='#']") : [];
  var headings = [];
  var ticking = false;

  if (!progress || !value || !label || !article || !articleBody) {
    return;
  }

  Array.prototype.forEach.call(tocLinks, function (link) {
    var id = decodeURIComponent(link.hash.slice(1));
    var heading = document.getElementById(id);
    if (heading) headings.push({ heading: heading, link: link });
  });

  function scrollTop() {
    return window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
  }

  function articleTop() {
    return article.getBoundingClientRect().top + scrollTop();
  }

  function updateProgress() {
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var start = articleBody.getBoundingClientRect().top + scrollTop();
    var finish = Math.max(start + articleBody.offsetHeight - viewportHeight, start + 1);
    var amount = (scrollTop() - start) / (finish - start);
    var percent = Math.max(0, Math.min(100, Math.round(amount * 100)));

    value.style.width = percent + "%";
    label.innerHTML = "[" + percent + "%]";
    progress.setAttribute("aria-valuenow", percent);
    if (backToTop) backToTop.classList.toggle("is-visible", scrollTop() > Math.min(start, 480));

    var active = null;
    Array.prototype.forEach.call(headings, function (item) {
      if (item.heading.getBoundingClientRect().top <= 140) active = item;
      item.link.removeAttribute("aria-current");
    });
    if (!active && headings.length) active = headings[0];
    if (active) active.link.setAttribute("aria-current", "location");
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) {
      return;
    }

    ticking = true;
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(updateProgress);
    } else {
      window.setTimeout(updateProgress, 16);
    }
  }

  updateProgress();
  if (tocToggle && toc) {
    if (window.matchMedia && window.matchMedia("(max-width: 1359px)").matches) {
      toc.classList.add("is-collapsed");
      tocToggle.setAttribute("aria-expanded", "false");
      tocToggle.setAttribute("title", "显示目录");
      tocToggle.getElementsByClassName("toc__toggle-label")[0].textContent = "toc";
      tocToggle.lastElementChild.textContent = "[+]";
    }
    tocToggle.addEventListener("click", function () {
      var collapsed = toc.classList.toggle("is-collapsed");
      tocToggle.setAttribute("aria-expanded", String(!collapsed));
      tocToggle.setAttribute("title", collapsed ? "显示目录" : "隐藏目录");
      tocToggle.getElementsByClassName("toc__toggle-label")[0].textContent = collapsed ? "show" : "hide";
      tocToggle.lastElementChild.textContent = collapsed ? "[+]" : "[-]";
    });
    Array.prototype.forEach.call(tocLinks, function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia && window.matchMedia("(max-width: 1359px)").matches) {
          toc.classList.add("is-collapsed");
          tocToggle.setAttribute("aria-expanded", "false");
          tocToggle.setAttribute("title", "显示目录");
          tocToggle.getElementsByClassName("toc__toggle-label")[0].textContent = "toc";
          tocToggle.lastElementChild.textContent = "[+]";
        }
      });
    });
  }
  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  window.addEventListener("scroll", requestUpdate, false);
  window.addEventListener("resize", requestUpdate, false);
  window.addEventListener("load", requestUpdate, false);
}());

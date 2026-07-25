(function () {
  "use strict";

  if (document.documentElement.getAttribute("data-eink") === "true") {
    return;
  }

  var progress = document.getElementById("reading-progress");
  var value = progress && progress.getElementsByClassName("reading-progress__value")[0];
  var label = progress && progress.getElementsByClassName("reading-progress__label")[0];
  var article = document.getElementsByClassName("post")[0];
  var ticking = false;

  if (!progress || !value || !label || !article) {
    return;
  }

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
    var start = articleTop();
    var finish = Math.max(start + article.offsetHeight - viewportHeight, start + 1);
    var amount = (scrollTop() - start) / (finish - start);
    var percent = Math.max(0, Math.min(100, Math.round(amount * 100)));

    value.style.width = percent + "%";
    label.innerHTML = "[" + percent + "%]";
    progress.setAttribute("aria-valuenow", percent);
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
  window.addEventListener("scroll", requestUpdate, false);
  window.addEventListener("resize", requestUpdate, false);
  window.addEventListener("load", requestUpdate, false);
}());

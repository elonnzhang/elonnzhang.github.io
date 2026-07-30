(function () {
  "use strict";

  var root = document.documentElement;
  var overlay = document.getElementById("space-ink-transition");
  var prefix = document.getElementById("space-ink-transition-prefix");
  var target = document.getElementById("space-ink-transition-target");
  var bloom = document.getElementsByClassName("space-ink-transition__bloom")[0];
  var links = document.getElementsByClassName("space-switcher__menu")[0];
  var active = false;
  var isMonochrome = window.matchMedia &&
    window.matchMedia("(monochrome)").matches;

  if (!overlay || !prefix || !target || !bloom || !links ||
      root.getAttribute("data-eink") === "true" ||
      isMonochrome) {
    return;
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function resetTransition() {
    var expression = /(?:^|\s)space-transition-running(?=\s|$)/g;

    active = false;
    overlay.className = "space-ink-transition";
    prefix.innerHTML = "$ entering ";
    target.innerHTML = "";
    root.className = root.className.replace(expression, "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/\s{2,}/g, " ");
  }

  function isModifiedClick(event) {
    return event.button > 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;
  }

  function spaceLink(element) {
    while (element && element !== links) {
      if (element.tagName &&
          element.tagName.toLowerCase() === "a" &&
          element.getAttribute("data-space-link")) {
        return element;
      }
      element = element.parentNode;
    }
    return null;
  }

  function navigate(event) {
    var link = spaceLink(event.target || event.srcElement);
    var details;
    var space;

    if (!link) {
      return;
    }
    space = link.getAttribute("data-space-link");
    if (space !== "ink-reader") {
      return;
    }
    if (active) {
      if (event.preventDefault) {
        event.preventDefault();
      }
      event.returnValue = false;
      return;
    }
    if (isModifiedClick(event) ||
        link.getAttribute("aria-current") === "page" ||
        link.getAttribute("target") ||
        link.getAttribute("download") ||
        prefersReducedMotion()) {
      return;
    }

    if (event.preventDefault) {
      event.preventDefault();
    }
    event.returnValue = false;
    active = true;
    prefix.innerHTML = "$ entering ";
    target.innerHTML = "";
    target.appendChild(document.createTextNode(space));
    details = link.parentNode && link.parentNode.parentNode;
    if (details && details.tagName &&
        details.tagName.toLowerCase() === "details") {
      details.removeAttribute("open");
    }
    overlay.className += " is-active";
    overlay.className += " is-ink-reader";
    if (!bloom.getAttribute("src")) {
      bloom.src = bloom.getAttribute("data-src");
    }
    try {
      window.sessionStorage.setItem(
        "elonnzhang-space-arrival",
        "ink-reader"
      );
    } catch (error) {}
    root.className += " space-transition-running";

    window.setTimeout(function () {
      window.location.href = link.href;
    }, 1080);
  }

  if (links.addEventListener) {
    links.addEventListener("click", navigate, false);
    window.addEventListener("pageshow", resetTransition, false);
  } else {
    links.onclick = navigate;
    window.attachEvent("onpageshow", resetTransition);
  }
}());

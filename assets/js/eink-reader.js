(function () {
  "use strict";

  var root = document.documentElement;

  if (root.getAttribute("data-eink") !== "true") {
    return;
  }

  function forceCodeColors() {
    var codeBlocks = document.getElementsByTagName("pre");
    var inlineCode = document.getElementsByTagName("code");
    var blockIndex;
    var childIndex;
    var codeIndex;

    for (blockIndex = 0; blockIndex < codeBlocks.length; blockIndex += 1) {
      var block = codeBlocks[blockIndex];
      var children = block.getElementsByTagName("*");

      block.style.backgroundColor = "#ffffff";
      block.style.borderColor = "#000000";
      block.style.color = "#000000";
      block.style.boxShadow = "none";

      for (childIndex = 0; childIndex < children.length; childIndex += 1) {
        children[childIndex].style.backgroundColor = "transparent";
        children[childIndex].style.color = "#000000";
      }
    }

    for (codeIndex = 0; codeIndex < inlineCode.length; codeIndex += 1) {
      var parent = inlineCode[codeIndex].parentNode;

      inlineCode[codeIndex].style.color = "#000000";
      if (!parent || !parent.tagName || parent.tagName.toLowerCase() !== "pre") {
        inlineCode[codeIndex].style.backgroundColor = "#ffffff";
      }
    }
  }

  function carryEinkParameter() {
    var links = document.getElementsByTagName("a");
    var currentHost = window.location.host;
    var index;

    for (index = 0; index < links.length; index += 1) {
      var link = links[index];
      var href = link.getAttribute("href");
      var hash = "";
      var hashIndex;
      var separator;

      if (!href ||
          href.charAt(0) === "#" ||
          link.getAttribute("data-eink-native") === "true" ||
          /^(?:mailto|tel|javascript|data):/i.test(href) ||
          (link.host && link.host !== currentHost)) {
        continue;
      }

      hashIndex = href.indexOf("#");
      if (hashIndex !== -1) {
        hash = href.substring(hashIndex);
        href = href.substring(0, hashIndex);
      }

      if (/(?:\?|&)eink=[^&]*/.test(href)) {
        href = href.replace(/([?&])eink=[^&]*/, "$1eink=1");
      } else {
        separator = href.indexOf("?") === -1 ? "?" : "&";
        href += separator + "eink=1";
      }

      link.setAttribute("href", href + hash);
    }
  }

  function configureWebModeLink() {
    var links = document.getElementsByTagName("a");
    var query = window.location.search.replace(/^\?/, "");
    var parameters = query ? query.split("&") : [];
    var kept = [];
    var index;
    var parameterIndex;
    var key;

    for (parameterIndex = 0;
      parameterIndex < parameters.length;
      parameterIndex += 1) {
      key = parameters[parameterIndex].split("=")[0].toLowerCase();
      if (parameters[parameterIndex] &&
          key !== "eink" &&
          key !== "web") {
        kept.push(parameters[parameterIndex]);
      }
    }
    kept.push("web=1");

    for (index = 0; index < links.length; index += 1) {
      if (links[index].getAttribute("data-web-mode-link") === "true") {
        links[index].setAttribute(
          "href",
          window.location.pathname + "?" + kept.join("&") +
            window.location.hash
        );
      }
    }
  }

  function hasColumnSupport() {
    var style = document.createElement("div").style;

    return typeof style.columnWidth !== "undefined" ||
      typeof style.webkitColumnWidth !== "undefined";
  }

  function addEvent(target, name, handler) {
    if (target.addEventListener) {
      target.addEventListener(name, handler, false);
    } else if (target.attachEvent) {
      target.attachEvent("on" + name, handler);
    }
  }

  function findReader() {
    var posts = document.getElementsByClassName("post");
    var docs = document.getElementsByClassName("code-space-doc");
    var remoteDocs = document.getElementsByClassName("ink-reader-article");
    var remoteDoc = remoteDocs[0];

    if (remoteDoc && remoteDoc.className.indexOf("is-ready") !== -1) {
      return remoteDoc;
    }
    return posts[0] || docs[0] || null;
  }

  function createButton(label, className, direction) {
    var button = document.createElement("button");

    button.type = "button";
    button.className = "eink-reader__button " + className;
    button.setAttribute("data-direction", direction);
    button.appendChild(document.createTextNode(label));
    return button;
  }

  function startReader(reader) {
    if (!reader || reader.getAttribute("data-eink-reader-started") === "true") {
      return;
    }

    if (reader.className.indexOf("ink-reader-article") !== -1 &&
        root.getAttribute("data-kindle") !== "true" &&
        (window.innerWidth || document.documentElement.clientWidth) <= 720) {
      return;
    }

    reader.setAttribute("data-eink-reader-started", "true");

    var controls = document.createElement("nav");
    var previous = createButton("< PREV", "eink-reader__button--previous", "previous");
    var next = createButton("NEXT >", "eink-reader__button--next", "next");
    var status = document.createElement("span");
    var currentPage = 0;
    var pageCount = 1;
    var pageWidth = 0;
    var resizeTimer = null;
    var originalReaderStyle = reader.getAttribute("style");

    controls.className = "eink-reader";
    controls.setAttribute("aria-label", "E-Ink 正文翻页");
    status.className = "eink-reader__status";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    controls.appendChild(previous);
    controls.appendChild(status);
    controls.appendChild(next);
    reader.parentNode.insertBefore(controls, reader.nextSibling);

    function twoDigits(value) {
      return value < 10 ? "0" + value : String(value);
    }

    function updateControls() {
      previous.disabled = currentPage === 0;
      next.disabled = currentPage >= pageCount - 1;
      status.innerHTML = "PAGE " + twoDigits(currentPage + 1) +
        "/" + twoDigits(pageCount);
    }

    function showPage(page) {
      currentPage = Math.max(0, Math.min(pageCount - 1, page));
      reader.scrollLeft = currentPage * pageWidth;
      updateControls();
    }

    function sizeTallContent(availableHeight) {
      var tags = ["pre", "table", "img", "video", "iframe"];
      var maxHeight = Math.max(180, availableHeight - 32) + "px";
      var tagIndex;
      var itemIndex;

      for (tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
        var items = reader.getElementsByTagName(tags[tagIndex]);
        for (itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
          if (typeof items[itemIndex]._einkReaderMaxHeight === "undefined") {
            items[itemIndex]._einkReaderMaxHeight =
              items[itemIndex].style.maxHeight || "";
          }
          items[itemIndex].style.maxHeight = maxHeight;
        }
      }
    }

    function removeClass(element, className) {
      var expression = new RegExp("(?:^|\\s)" + className + "(?=\\s|$)", "g");

      element.className = element.className.replace(expression, "")
        .replace(/^\s+|\s+$/g, "")
        .replace(/\s{2,}/g, " ");
    }

    function clearTallContent() {
      var tags = ["pre", "table", "img", "video", "iframe"];
      var tagIndex;
      var itemIndex;

      for (tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
        var items = reader.getElementsByTagName(tags[tagIndex]);
        for (itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
          if (typeof items[itemIndex]._einkReaderMaxHeight !== "undefined") {
            items[itemIndex].style.maxHeight =
              items[itemIndex]._einkReaderMaxHeight;
            items[itemIndex]._einkReaderMaxHeight = undefined;
          }
        }
      }
    }

    function disableReader() {
      removeClass(root, "eink-reader-enabled");
      removeClass(reader, "eink-reader__pages");
      controls.style.display = "none";
      reader.scrollLeft = 0;
      clearTallContent();
      if (originalReaderStyle === null) {
        reader.removeAttribute("style");
      } else {
        reader.setAttribute("style", originalReaderStyle);
      }
    }

    function measure() {
      var viewportHeight = window.innerHeight ||
        document.documentElement.clientHeight ||
        600;
      var readerTop = reader.getBoundingClientRect().top;
      var controlsHeight = controls.offsetHeight || 48;
      var availableHeight = viewportHeight - Math.max(0, readerTop) -
        controlsHeight - 12;
      var previousPage = currentPage;
      var naturalHeight = reader.scrollHeight;
      var hasVerticalOverflow;
      var missingColumns;

      if (availableHeight < 240 || reader.clientWidth < 240) {
        disableReader();
        return;
      }

      controls.style.display = "";
      if (reader.className.indexOf("eink-reader__pages") === -1) {
        reader.className += " eink-reader__pages";
      }

      reader.style.height = availableHeight + "px";
      reader.style.columnWidth = reader.clientWidth + "px";
      reader.style.webkitColumnWidth = reader.clientWidth + "px";
      reader.style.columnGap = "0";
      reader.style.webkitColumnGap = "0";
      sizeTallContent(availableHeight);

      pageWidth = reader.clientWidth;
      pageCount = Math.max(1, Math.ceil((reader.scrollWidth - 1) / pageWidth));
      hasVerticalOverflow = reader.scrollHeight > reader.clientHeight + 2;
      missingColumns = naturalHeight > availableHeight + 2 && pageCount < 2;

      if (hasVerticalOverflow || missingColumns ||
          !isFinite(pageCount) || pageWidth < 1) {
        disableReader();
        return;
      }

      if (root.className.indexOf("eink-reader-enabled") === -1) {
        root.className += " eink-reader-enabled";
      }
      showPage(Math.min(previousPage, pageCount - 1));
    }

    function changePage(event) {
      var direction = event.currentTarget ?
        event.currentTarget.getAttribute("data-direction") :
        this.getAttribute("data-direction");

      showPage(currentPage + (direction === "next" ? 1 : -1));
    }

    function handleKey(event) {
      var key = event.key || event.keyCode;
      var target = event.target || event.srcElement;
      var tagName = target && target.tagName ?
        target.tagName.toLowerCase() :
        "";

      if (tagName === "input" || tagName === "textarea" ||
          tagName === "select" || tagName === "button") {
        return;
      }

      if (key === "ArrowLeft" || key === "PageUp" || key === 37 || key === 33) {
        showPage(currentPage - 1);
      } else if (key === "ArrowRight" || key === "PageDown" ||
          key === " " || key === 39 || key === 34 || key === 32) {
        showPage(currentPage + 1);
      } else {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault();
      }
      event.returnValue = false;
    }

    function scheduleMeasure() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 100);
    }

    addEvent(previous, "click", changePage);
    addEvent(next, "click", changePage);
    addEvent(document, "keydown", handleKey);
    addEvent(window, "resize", scheduleMeasure);
    addEvent(window, "orientationchange", measure);
    addEvent(window, "load", measure);

    var readerImages = reader.getElementsByTagName("img");
    var readerImageIndex;
    for (readerImageIndex = 0;
        readerImageIndex < readerImages.length;
        readerImageIndex += 1) {
      addEvent(readerImages[readerImageIndex], "load", scheduleMeasure);
      addEvent(readerImages[readerImageIndex], "error", scheduleMeasure);
    }

    measure();
  }

  forceCodeColors();
  configureWebModeLink();
  carryEinkParameter();

  window.EinkReader = {
    start: function (reader) {
      if (!hasColumnSupport()) {
        return;
      }
      forceCodeColors();
      startReader(reader);
    }
  };

  addEvent(document, "inkreader:contentready", function () {
    var dynamicReader = findReader();

    if (dynamicReader) {
      window.EinkReader.start(dynamicReader);
    }
  });

  var reader = findReader();
  if (reader && hasColumnSupport()) {
    startReader(reader);
  }
}());

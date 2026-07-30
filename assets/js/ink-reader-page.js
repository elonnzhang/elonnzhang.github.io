(function () {
  "use strict";

  var app = document.getElementById("ink-reader-app");
  var form = document.getElementById("ink-reader-form");
  var input = document.getElementById("ink-reader-url");
  var submit = document.getElementById("ink-reader-submit");
  var status = document.getElementById("ink-reader-status");
  var article = document.getElementById("ink-reader-article");
  var title = document.getElementById("ink-reader-title");
  var source = document.getElementById("ink-reader-source");
  var published = document.getElementById("ink-reader-published");
  var content = document.getElementById("ink-reader-content");
  var currentUrl = "";
  var maxResponseBytes = 2 * 1024 * 1024;

  if (!app || !form || !input || !submit || !status || !article || !content) {
    return;
  }

  function trim(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "");
  }

  function truncate(value, length) {
    return trim(value).substring(0, length);
  }

  function addClass(element, className) {
    if (element.className.indexOf(className) === -1) {
      element.className += (element.className ? " " : "") + className;
    }
  }

  function removeClass(element, className) {
    var expression = new RegExp("(?:^|\\s)" + className + "(?=\\s|$)", "g");

    element.className = element.className.replace(expression, "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/\s{2,}/g, " ");
  }

  function setStatus(message, state) {
    status.className = "ink-reader-status";
    if (state) {
      addClass(status, "is-" + state);
    }
    status.innerHTML = "";
    status.appendChild(document.createTextNode("$ " + message));
  }

  function isPrivateHost(hostname) {
    var host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    var parts = host.split(".");
    var first = parseInt(parts[0], 10);
    var second = parseInt(parts[1], 10);

    if (host === "localhost" || host === "::1" ||
        /\.localhost$/.test(host) || /\.local$/.test(host) ||
        /\.internal$/.test(host)) {
      return true;
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        first === 0;
    }

    return /^\d+$/.test(host) ||
      /^0x/i.test(host) ||
      /^fc/i.test(host) ||
      /^fd/i.test(host) ||
      /^fe[89ab]/i.test(host);
  }

  function normalizeUrl(value) {
    var raw = trim(value);
    var parser;

    if (!raw) {
      throw new Error("URL_REQUIRED");
    }
    if (raw.length > 2048) {
      throw new Error("URL_TOO_LONG");
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      raw = "https://" + raw;
    }

    parser = document.createElement("a");
    parser.href = raw;

    if (!/^https?:$/i.test(parser.protocol) || !parser.hostname) {
      throw new Error("URL_INVALID");
    }
    if (/^[^\/?#]*@/.test(raw.replace(/^https?:\/\//i, ""))) {
      throw new Error("URL_CREDENTIALS");
    }
    if (isPrivateHost(parser.hostname)) {
      throw new Error("URL_PRIVATE");
    }

    return parser.href;
  }

  function parseReaderResponse(text, fallbackUrl) {
    var marker = "Markdown Content:";
    var markerIndex = text.indexOf(marker);
    var heading = text.match(/^Title:\s*(.+)$/m);
    var sourceUrl = text.match(/^URL Source:\s*(.+)$/m);
    var publishedTime = text.match(/^Published Time:\s*(.+)$/m);
    var warning = text.match(/^Warning:\s*(.+)$/m);
    var fallback = document.createElement("a");
    var markdown = trim(markerIndex === -1 ?
      text :
      text.substring(markerIndex + marker.length));

    fallback.href = fallbackUrl;

    return {
      title: truncate(heading && heading[1], 300) ||
        fallback.hostname ||
        "Remote document",
      source: truncate(sourceUrl && sourceUrl[1], 2048) || fallbackUrl,
      published: truncate(publishedTime && publishedTime[1], 120),
      markdown: markdown,
      requiresVerification:
        /captcha|verification/i.test(trim(warning && warning[1])) ||
        /环境异常[\s\S]{0,120}(?:验证|继续访问)/.test(markdown)
    };
  }

  function absoluteUrl(value, baseUrl) {
    var raw = trim(value);
    var base = document.createElement("a");
    var parser = document.createElement("a");

    if (!raw) {
      return "";
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      parser.href = raw;
      return parser.href;
    }

    base.href = baseUrl;
    if (raw.substring(0, 2) === "//") {
      parser.href = base.protocol + raw;
    } else if (raw.charAt(0) === "/") {
      parser.href = base.protocol + "//" + base.host + raw;
    } else if (raw.charAt(0) === "#") {
      parser.href = base.href.replace(/#.*$/, "") + raw;
    } else if (raw.charAt(0) === "?") {
      parser.href = base.href.replace(/[?#].*$/, "") + raw;
    } else {
      parser.href = base.protocol + "//" + base.host +
        base.pathname.replace(/[^\/]*$/, "") + raw;
    }
    return parser.href;
  }

  function hardenRenderedContent(container, baseUrl) {
    var links = container.getElementsByTagName ?
      container.getElementsByTagName("a") :
      container.querySelectorAll("a");
    var images = container.getElementsByTagName ?
      container.getElementsByTagName("img") :
      container.querySelectorAll("img");
    var index;

    for (index = 0; index < links.length; index += 1) {
      var href = absoluteUrl(links[index].getAttribute("href") || "", baseUrl);

      if (!/^(?:https?:|mailto:)/i.test(href)) {
        links[index].removeAttribute("href");
      } else {
        links[index].setAttribute("href", href);
      }
      if (/^https?:/i.test(href)) {
        links[index].setAttribute("target", "_blank");
        links[index].setAttribute("rel", "noopener noreferrer");
      }
    }

    for (index = 0; index < images.length; index += 1) {
      var src = absoluteUrl(images[index].getAttribute("src") || "", baseUrl);

      if (!/^https?:/i.test(src)) {
        images[index].parentNode.removeChild(images[index]);
        index -= 1;
      } else {
        images[index].setAttribute("src", src);
        images[index].setAttribute("loading", "lazy");
        images[index].setAttribute("referrerpolicy", "no-referrer");
        if (!images[index].getAttribute("alt")) {
          images[index].setAttribute("alt", "");
        }
      }
    }
  }

  function renderMarkdown(markdown, baseUrl) {
    var dirty;
    var cleanFragment;

    removeClass(content, "is-plain-text");

    if (window.marked && typeof window.marked.parse === "function" &&
        window.DOMPurify && window.DOMPurify.isSupported !== false) {
      dirty = window.marked.parse(markdown, {
        gfm: true,
        headerIds: false,
        mangle: false
      });
      cleanFragment = window.DOMPurify.sanitize(dirty, {
        USE_PROFILES: {html: true},
        RETURN_DOM_FRAGMENT: true,
        FORBID_TAGS: [
          "style", "form", "input", "button", "textarea", "select",
          "iframe", "video", "audio", "object", "embed"
        ],
        FORBID_ATTR: ["style", "srcset"]
      });
      if (cleanFragment &&
          (cleanFragment.getElementsByTagName || cleanFragment.querySelectorAll)) {
        hardenRenderedContent(cleanFragment, baseUrl);
        content.innerHTML = "";
        content.appendChild(cleanFragment);
        return;
      }
    }

    addClass(content, "is-plain-text");
    content.innerHTML = "";
    content.appendChild(document.createTextNode(markdown));
  }

  function updateHistory(url) {
    if (!window.history || !window.history.replaceState) {
      return;
    }

    window.history.replaceState(
      null,
      "",
      window.location.pathname + "?url=" + encodeURIComponent(url)
    );
  }

  function notifyReader() {
    var event;

    if (window.EinkReader && window.EinkReader.start) {
      window.EinkReader.start(article);
      return;
    }

    if (document.createEvent) {
      event = document.createEvent("Event");
      event.initEvent("inkreader:contentready", true, true);
      document.dispatchEvent(event);
    }
  }

  function renderDocument(documentData, requestedUrl) {
    var sourceUrl = /^https?:\/\//i.test(documentData.source) ?
      documentData.source :
      requestedUrl;

    title.innerHTML = "";
    title.appendChild(document.createTextNode(documentData.title));
    source.href = sourceUrl;
    published.innerHTML = "";
    if (documentData.published) {
      published.removeAttribute("hidden");
      published.appendChild(document.createTextNode(
        " / PUBLISHED " + documentData.published
      ));
    } else {
      published.setAttribute("hidden", "hidden");
    }

    renderMarkdown(documentData.markdown, sourceUrl);
    article.removeAttribute("hidden");
    addClass(article, "is-ready");
    addClass(app, "is-reading");
    currentUrl = requestedUrl;
    document.title = documentData.title + " | Ink Reader";
    setStatus("ready", "ready");
    updateHistory(requestedUrl);
    notifyReader();
  }

  function renderVerificationNotice(requestedUrl) {
    var notice = document.createElement("div");
    var first = document.createElement("p");
    var second = document.createElement("p");

    title.innerHTML = "";
    title.appendChild(document.createTextNode("该来源需要人工验证"));
    source.href = requestedUrl;
    published.setAttribute("hidden", "hidden");
    published.innerHTML = "";

    first.appendChild(document.createTextNode(
      "微信公众平台拒绝了自动抓取请求，返回的是环境验证页，不是文章正文。"
    ));
    second.appendChild(document.createTextNode(
      "Ink Reader 无法代替访客完成验证。请通过 SOURCE 阅读原文，或将正文保存到 Clippings 后使用本站的墨水屏模式阅读。"
    ));
    notice.className = "ink-reader-restriction";
    notice.appendChild(first);
    notice.appendChild(second);
    content.innerHTML = "";
    content.appendChild(notice);

    article.removeAttribute("hidden");
    addClass(article, "is-ready");
    addClass(app, "is-reading");
    currentUrl = requestedUrl;
    document.title = "Source verification required | Ink Reader";
    setStatus("ERR SOURCE_REQUIRES_VERIFICATION", "error");
    updateHistory(requestedUrl);
  }

  function errorMessage(error) {
    var messages = {
      URL_REQUIRED: "ERR URL_REQUIRED",
      URL_TOO_LONG: "ERR URL_TOO_LONG",
      URL_INVALID: "ERR HTTP_OR_HTTPS_REQUIRED",
      URL_CREDENTIALS: "ERR URL_CREDENTIALS_NOT_ALLOWED",
      URL_PRIVATE: "ERR PRIVATE_ADDRESS_NOT_ALLOWED",
      FETCH_TIMEOUT: "ERR FETCH_TIMEOUT, RETRY",
      FETCH_EMPTY: "ERR NO_READABLE_CONTENT"
    };

    return messages[error.message] || error.message || "ERR FETCH_FAILED";
  }

  function loadUrl(rawUrl) {
    var requestedUrl;
    var request;
    var responseTooLarge = false;

    try {
      requestedUrl = normalizeUrl(rawUrl);
    } catch (error) {
      setStatus(errorMessage(error), "error");
      input.focus();
      return;
    }

    if (currentUrl && currentUrl !== requestedUrl) {
      window.location.href = window.location.pathname +
        "?url=" + encodeURIComponent(requestedUrl);
      return;
    }

    input.value = requestedUrl;
    input.disabled = true;
    submit.disabled = true;
    submit.innerHTML = "WAIT";
    setStatus("fetching remote document...", "loading");

    request = new XMLHttpRequest();
    request.open("GET", "https://r.jina.ai/" + requestedUrl, true);
    request.timeout = 45000;

    request.onreadystatechange = function () {
      var parsed;

      if (request.readyState !== 4) {
        return;
      }

      input.disabled = false;
      submit.disabled = false;
      submit.innerHTML = "READ";

      if (responseTooLarge) {
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        setStatus("ERR FETCH_" + request.status + ", RETRY", "error");
        return;
      }
      if ((request.responseText || "").length > maxResponseBytes) {
        setStatus("ERR CONTENT_TOO_LARGE", "error");
        return;
      }

      parsed = parseReaderResponse(request.responseText || "", requestedUrl);
      if (!parsed.markdown) {
        setStatus(errorMessage(new Error("FETCH_EMPTY")), "error");
        return;
      }
      if (parsed.requiresVerification) {
        renderVerificationNotice(requestedUrl);
        return;
      }
      try {
        renderDocument(parsed, requestedUrl);
      } catch (error) {
        setStatus("ERR RENDER_FAILED", "error");
      }
    };

    request.onprogress = function (event) {
      if (event.loaded <= maxResponseBytes) {
        return;
      }

      responseTooLarge = true;
      request.abort();
      input.disabled = false;
      submit.disabled = false;
      submit.innerHTML = "READ";
      setStatus("ERR CONTENT_TOO_LARGE", "error");
    };

    request.ontimeout = function () {
      input.disabled = false;
      submit.disabled = false;
      submit.innerHTML = "READ";
      setStatus(errorMessage(new Error("FETCH_TIMEOUT")), "error");
    };

    request.onerror = function () {
      if (responseTooLarge) {
        return;
      }
      input.disabled = false;
      submit.disabled = false;
      submit.innerHTML = "READ";
      setStatus("ERR NETWORK_OR_CORS, RETRY", "error");
    };

    request.send(null);
  }

  function queryValue(name) {
    var expression = new RegExp("(?:^|&)" + name + "=([^&]*)");
    var match = expression.exec(window.location.search.substring(1));

    if (!match) {
      return "";
    }

    try {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    } catch (error) {
      return "";
    }
  }

  form.onsubmit = function (event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    loadUrl(input.value);
    return false;
  };

  var initialUrl = queryValue("url");
  if (initialUrl) {
    input.value = initialUrl;
    loadUrl(initialUrl);
  } else {
    input.focus();
  }
}());

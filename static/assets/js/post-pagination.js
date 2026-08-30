(function () {
  "use strict";

  var root = document.documentElement;
  var list = document.getElementById("post-list");
  var footer = document.getElementById("post-list-footer");
  var controls = document.getElementById("post-list-controls");
  var select = document.getElementById("posts-per-page");
  var range = document.getElementById("post-list-range");
  var clientPagination = document.getElementById("client-pagination");
  var staticPagination = document.getElementById("static-pagination");
  var script = document.currentScript;
  var storageKey = "elonnzhang-posts-per-page";
  var allowedSizes = [10, 20, 30];
  var posts = [];
  var perPage = 10;
  var currentPage = 1;

  if (!list || !footer || !controls || !select || !range ||
      !clientPagination || !script ||
      root.getAttribute("data-eink") === "true") {
    return;
  }

  function numberFrom(value, fallback) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  function allowedSize(value) {
    var size = numberFrom(value, 10);
    var index;

    for (index = 0; index < allowedSizes.length; index += 1) {
      if (allowedSizes[index] === size) {
        return size;
      }
    }
    return 10;
  }

  function queryValue(name) {
    var match = window.location.search.match(
      new RegExp("(?:^|[?&])" + name + "=([^&]*)")
    );
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }

  function storedSize() {
    try {
      return window.localStorage.getItem(storageKey) || "";
    } catch (error) {
      return "";
    }
  }

  function storeSize(value) {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch (error) {
      // Pagination still works when storage is unavailable.
    }
  }

  function initialPage() {
    var pathMatch = window.location.pathname.match(/\/page\/(\d+)\/?$/);
    return Math.max(1, numberFrom(queryValue("page"), pathMatch ? pathMatch[1] : 1));
  }

  function appendText(parent, tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.appendChild(document.createTextNode(text));
    parent.appendChild(element);
    return element;
  }

  function postRow(post) {
    var item = document.createElement("li");
    var time = appendText(item, "time", "post-list__date", post.date);
    var prompt = appendText(item, "span", "post-list__prompt", ">");
    var heading = document.createElement("h2");
    var link = appendText(heading, "a", "", post.title);
    var category = document.createElement("span");
    var description = document.createElement("span");
    var separator = appendText(description, "span", "", "—");

    time.setAttribute("datetime", post.date);
    prompt.setAttribute("aria-hidden", "true");
    link.setAttribute("href", post.url);
    link.setAttribute("title", post.title);
    item.appendChild(heading);
    category.className = "post-list__category";
    category.appendChild(document.createTextNode("[" + post.category + "]"));
    item.appendChild(category);
    category.setAttribute("title", post.category);
    description.className = "post-list__description";
    description.setAttribute("tabindex", "0");
    description.setAttribute("data-description", post.description);
    description.setAttribute("aria-label", "文章摘要：" + post.description);
    separator.setAttribute("aria-hidden", "true");
    description.appendChild(document.createTextNode(" " + post.description));
    item.appendChild(description);
    item.className = "post-list__item";
    return item;
  }

  function pageButton(label, page, ariaLabel, current, disabled) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "page-item" +
      (current ? " is-current" : "") +
      (disabled ? " is-disabled" : "");
    button.appendChild(document.createTextNode(label));
    if (ariaLabel) {
      button.setAttribute("aria-label", ariaLabel);
    }
    if (current) {
      button.setAttribute("aria-current", "page");
    } else if (disabled) {
      button.disabled = true;
    } else {
      button.addEventListener("click", function () {
        currentPage = page;
        render();
        window.scrollTo(0, 0);
      });
    }
    return button;
  }

  function updateUrl() {
    var rootUrl = script.getAttribute("data-root-url") || "/";
    var query = "?page=" + currentPage + "&per_page=" + perPage;

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", rootUrl + query);
    }
  }

  function renderPagination(totalPages) {
    var page;

    clientPagination.textContent = "";
    if (totalPages <= 1) {
      clientPagination.hidden = true;
      return;
    }

    clientPagination.appendChild(
      pageButton(
        "«",
        Math.max(1, currentPage - 1),
        "上一页",
        false,
        currentPage === 1
      )
    );
    for (page = 1; page <= totalPages; page += 1) {
      clientPagination.appendChild(
        pageButton(String(page), page, "", page === currentPage, false)
      );
    }
    clientPagination.appendChild(
      pageButton(
        "»",
        Math.min(totalPages, currentPage + 1),
        "下一页",
        false,
        currentPage === totalPages
      )
    );
    clientPagination.hidden = false;
  }

  function render() {
    var totalPages = Math.max(1, Math.ceil(posts.length / perPage));
    var start;
    var end;
    var fragment = document.createDocumentFragment();
    var index;

    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    start = (currentPage - 1) * perPage;
    end = Math.min(start + perPage, posts.length);

    for (index = start; index < end; index += 1) {
      fragment.appendChild(postRow(posts[index]));
    }
    list.textContent = "";
    list.appendChild(fragment);
    range.value = "[" + (start + 1) + "-" + end + "/" + posts.length + "]";
    renderPagination(totalPages);
    updateUrl();
  }

  function ready(data) {
    posts = data;
    perPage = allowedSize(queryValue("per_page") || storedSize());
    currentPage = initialPage();
    select.value = String(perPage);
    footer.hidden = false;
    if (staticPagination) {
      staticPagination.hidden = true;
    }
    select.addEventListener("change", function () {
      perPage = allowedSize(select.value);
      currentPage = 1;
      storeSize(String(perPage));
      render();
    });
    render();
  }

  function loadPosts() {
    var request = new XMLHttpRequest();
    request.open("GET", script.getAttribute("data-posts-url"), true);
    request.onreadystatechange = function () {
      if (request.readyState === 4 && request.status >= 200 && request.status < 300) {
        try {
          ready(JSON.parse(request.responseText));
        } catch (error) {
          // Keep the server-rendered pagination when the index is invalid.
        }
      }
    };
    request.send();
  }

  loadPosts();
}());

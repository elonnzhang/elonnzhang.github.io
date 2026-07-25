(function () {
  "use strict";

  var root = document.documentElement;
  var list = document.getElementById("collection-list");
  var footer = document.getElementById("collection-list-footer");
  var select = document.getElementById("collection-page-size");
  var range = document.getElementById("collection-list-range");
  var pagination = document.getElementById("collection-pagination");
  var einkPagination = document.getElementById("collection-eink-pagination");
  var script = document.currentScript ||
    document.getElementById("collection-pagination-script");
  var items;
  var groups;
  var isEink;
  var perPage;
  var currentPage;
  var totalPages;

  if (!list || !footer || !select || !range || !pagination ||
      !einkPagination || !script) {
    return;
  }

  items = list.getElementsByClassName("collection-page-item");
  groups = list.getElementsByClassName("collection-page-group");
  isEink = root.getAttribute("data-eink") === "true";

  if (!items.length) {
    return;
  }

  function numberFrom(value, fallback) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  function queryValue(name) {
    var match = window.location.search.match(
      new RegExp("(?:^|[?&])" + name + "=([^&]*)")
    );
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }

  function storedSize() {
    try {
      return window.localStorage.getItem(
        script.getAttribute("data-storage-key")
      ) || "";
    } catch (error) {
      return "";
    }
  }

  function storeSize(value) {
    try {
      window.localStorage.setItem(
        script.getAttribute("data-storage-key"),
        value
      );
    } catch (error) {
      // Query-string pagination still works without local storage.
    }
  }

  function allowedSize(value, fallback) {
    var size = numberFrom(value, fallback);
    var allowed = isEink ? [8, 10, 20, 30] : [10, 20, 30];
    var index;

    for (index = 0; index < allowed.length; index += 1) {
      if (allowed[index] === size) {
        return size;
      }
    }
    return fallback;
  }

  function pageUrl(page) {
    var rootUrl = script.getAttribute("data-root-url") || window.location.pathname;
    var query = "?page=" + page + "&per_page=" + perPage;

    if (isEink) {
      query += "&eink=1";
    }
    return rootUrl + query;
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

  function pageLink(parent, label, page, current, disabled, ariaLabel) {
    var element;

    if (current || disabled) {
      element = appendText(
        parent,
        "span",
        "page-item" +
          (current ? " is-current" : "") +
          (disabled ? " is-disabled" : ""),
        label
      );
      if (current) {
        element.setAttribute("aria-current", "page");
      } else {
        element.setAttribute("aria-disabled", "true");
      }
    } else {
      element = appendText(parent, "a", "page-item", label);
      element.setAttribute("href", pageUrl(page));
    }
    if (ariaLabel) {
      element.setAttribute("aria-label", ariaLabel);
    }
    return element;
  }

  function renderPagination() {
    var page;

    pagination.innerHTML = "";
    if (totalPages <= 1) {
      pagination.hidden = true;
      return;
    }

    pageLink(
      pagination,
      "\u00ab",
      Math.max(1, currentPage - 1),
      false,
      currentPage === 1,
      "上一页"
    );
    for (page = 1; page <= totalPages; page += 1) {
      pageLink(
        pagination,
        String(page),
        page,
        page === currentPage,
        false,
        ""
      );
    }
    pageLink(
      pagination,
      "\u00bb",
      Math.min(totalPages, currentPage + 1),
      false,
      currentPage === totalPages,
      "下一页"
    );
    pagination.hidden = false;
  }

  function einkControl(label, page, className, disabled) {
    var element;

    if (disabled) {
      element = appendText(
        einkPagination,
        "span",
        "eink-reader__button " + className + " is-disabled",
        label
      );
      element.setAttribute("aria-disabled", "true");
    } else {
      element = appendText(
        einkPagination,
        "a",
        "eink-reader__button " + className,
        label
      );
      element.setAttribute("href", pageUrl(page));
    }
    return element;
  }

  function renderEinkPagination() {
    var status;

    einkPagination.innerHTML = "";
    if (totalPages <= 1) {
      einkPagination.hidden = true;
      return;
    }

    einkControl(
      "< PREV",
      Math.max(1, currentPage - 1),
      "eink-reader__button--previous",
      currentPage === 1
    );
    status = appendText(
      einkPagination,
      "span",
      "eink-reader__status",
      "PAGE " + currentPage + "/" + totalPages
    );
    status.setAttribute("aria-current", "page");
    einkControl(
      "NEXT >",
      Math.min(totalPages, currentPage + 1),
      "eink-reader__button--next",
      currentPage === totalPages
    );
    einkPagination.hidden = false;
  }

  function updateGroups() {
    var groupIndex;
    var itemIndex;

    for (groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      var groupItems = groups[groupIndex].getElementsByClassName(
        "collection-page-item"
      );
      var hasVisibleItem = false;

      for (itemIndex = 0; itemIndex < groupItems.length; itemIndex += 1) {
        if (groupItems[itemIndex].style.display !== "none") {
          hasVisibleItem = true;
          break;
        }
      }
      groups[groupIndex].style.display = hasVisibleItem ? "" : "none";
    }
  }

  function render() {
    var start = (currentPage - 1) * perPage;
    var end = Math.min(start + perPage, items.length);
    var index;

    for (index = 0; index < items.length; index += 1) {
      if (index >= start && index < end) {
        items[index].style.display = "";
        items[index].removeAttribute("aria-hidden");
      } else {
        items[index].style.display = "none";
        items[index].setAttribute("aria-hidden", "true");
      }
    }

    updateGroups();
    range.value = "[" + (start + 1) + "-" + end + "/" + items.length + "]";

    if (isEink) {
      footer.hidden = true;
      renderEinkPagination();
    } else {
      einkPagination.hidden = true;
      footer.hidden = false;
      select.value = String(perPage);
      renderPagination();
    }
  }

  perPage = allowedSize(
    queryValue("per_page") || (isEink ? "" : storedSize()),
    isEink ? 8 : 10
  );
  totalPages = Math.max(1, Math.ceil(items.length / perPage));
  currentPage = Math.min(
    totalPages,
    Math.max(1, numberFrom(queryValue("page"), 1))
  );

  select.onchange = function () {
    perPage = allowedSize(select.value, 10);
    storeSize(String(perPage));
    window.location.href = pageUrl(1);
  };

  render();
}());

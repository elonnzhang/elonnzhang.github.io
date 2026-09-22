(function () {
  "use strict";

  var buttons = document.querySelectorAll("[data-back-button]");
  var index;

  function goBack(event) {
    var referrer;

    event = event || window.event;
    if (!document.referrer || !window.history || window.history.length <= 1) return;

    referrer = document.createElement("a");
    referrer.href = document.referrer;
    if (referrer.protocol !== window.location.protocol ||
        referrer.host !== window.location.host) {
      return;
    }

    if (event.preventDefault) event.preventDefault();
    event.returnValue = false;
    window.history.back();
  }

  for (index = 0; index < buttons.length; index += 1) {
    if (buttons[index].addEventListener) {
      buttons[index].addEventListener("click", goBack, false);
    } else {
      buttons[index].attachEvent("onclick", goBack);
    }
  }
}());

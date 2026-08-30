(function () {
  "use strict";

  var carousel = document.querySelector("[data-pages-carousel]");
  var previous = document.querySelector("[data-pages-prev]");
  var next = document.querySelector("[data-pages-next]");
  var status = document.querySelector("[data-pages-status]");

  if (!carousel || !previous || !next || !status) {
    return;
  }

  var cards = Array.prototype.slice.call(carousel.querySelectorAll(".landing-page-card"));
  var total = cards.length;
  var autoplayDelay = 6000;
  var autoplayTimer = null;
  var activeIndex = 0;
  var isMoving = false;

  if (!total) {
    return;
  }

  // Clone the first card so the last-to-first transition keeps moving forward.
  var loopCard = cards[0].cloneNode(true);
  loopCard.setAttribute("aria-hidden", "true");
  loopCard.setAttribute("inert", "");
  loopCard.classList.add("landing-page-card--clone");
  carousel.appendChild(loopCard);
  var trackCards = cards.concat(loopCard);

  function nearestIndex() {
    var closest = 0;
    var distance = Infinity;

    trackCards.forEach(function (card, index) {
      var cardDistance = Math.abs(card.offsetLeft - carousel.scrollLeft);
      if (cardDistance < distance) {
        distance = cardDistance;
        closest = index;
      }
    });

    return closest;
  }

  function updateStatus() {
    var visibleIndex = activeIndex === total ? 0 : activeIndex;
    status.textContent = String(visibleIndex + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
  }

  function move(step) {
    activeIndex += step;
    if (activeIndex < 0) {
      activeIndex = total - 1;
      carousel.scrollTo({ left: cards[activeIndex].offsetLeft, behavior: "auto" });
    }
    if (activeIndex > total) {
      activeIndex = 1;
      carousel.scrollTo({ left: cards[activeIndex].offsetLeft, behavior: "auto" });
    }
    isMoving = true;
    var targetCard = activeIndex === total ? loopCard : cards[activeIndex];
    carousel.scrollTo({ left: targetCard.offsetLeft, behavior: "smooth" });
    updateStatus();
    window.setTimeout(function () {
      if (activeIndex === total) {
        activeIndex = 0;
        carousel.scrollTo({ left: cards[0].offsetLeft, behavior: "auto" });
        updateStatus();
      }
      isMoving = false;
    }, 850);
  }

  function stopAutoplay() {
    if (autoplayTimer !== null) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    if (total < 2 || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      return;
    }
    stopAutoplay();
    autoplayTimer = window.setInterval(function () { move(1); }, autoplayDelay);
  }

  previous.addEventListener("click", function () { move(-1); startAutoplay(); });
  next.addEventListener("click", function () { move(1); startAutoplay(); });
  carousel.addEventListener("scroll", function () {
    if (!isMoving) {
      activeIndex = nearestIndex();
      updateStatus();
    }
  }, { passive: true });
  window.addEventListener("resize", updateStatus);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });
  updateStatus();
  startAutoplay();
}());

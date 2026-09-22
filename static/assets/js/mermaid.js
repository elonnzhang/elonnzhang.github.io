// Mermaid rendering — official startOnLoad-style integration.
// Renders every .mermaid element in one pass (robust across diagram types).
(function () {
  "use strict";

  if (!window.mermaid) {
    return;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "default",
    flowchart: {
      htmlLabels: false,
      useMaxWidth: true
    },
    sequence: {
      useMaxWidth: true
    },
    gantt: {
      useMaxWidth: true
    }
  });

  window.mermaid.run({ querySelector: ".mermaid" });
})();

// js/zoom.js

/**
 * enableZoom(options):
 *   - options.previewSelector: CSS selector string for the <svg> inside #preview.
 *   - options.zoomInBtn: selector string for the “+” button.
 *   - options.zoomOutBtn: selector string for the “−” button.
 *   - options.minScale: minimum allowed zoom level (e.g. 0.2).
 *   - options.maxScale: maximum allowed zoom level (e.g. 5).
 *   - options.step: how much to change scale per step (e.g. 0.1).
 */
export function enableZoom({
  previewSelector,
  zoomInBtn,
  zoomOutBtn,
  minScale = 0.5,
  maxScale = 3,
  step = 0.1,
}) {
  let scale = 1; // current zoom level

  // Helper to apply transform on the SVG
  function applyScale(svgEl) {
    svgEl.style.transform = `scale(${scale})`;
  }

  // Locate elements
  const svgEl = document.querySelector(previewSelector);
  const btnZoomIn = document.querySelector(zoomInBtn);
  const btnZoomOut = document.querySelector(zoomOutBtn);

  if (!svgEl) {
    console.warn(
      `enableZoom: could not find SVG with selector '${previewSelector}'.`
    );
    return;
  }
  if (!btnZoomIn || !btnZoomOut) {
    console.warn(
      `enableZoom: could not find zoom-in or zoom-out buttons ('${zoomInBtn}', '${zoomOutBtn}').`
    );
    return;
  }

  // Mouse wheel handler to zoom in/out
  svgEl.addEventListener("wheel", (event) => {
    event.preventDefault();
    // On most mice, event.deltaY > 0 means scrolling down (zoom out),
    // and event.deltaY < 0 means scrolling up (zoom in).
    if (event.deltaY < 0) {
      // Zoom in
      scale = Math.min(maxScale, scale + step);
    } else {
      // Zoom out
      scale = Math.max(minScale, scale - step);
    }
    applyScale(svgEl);
  });

  // Button click handlers
  btnZoomIn.addEventListener("click", () => {
    scale = Math.min(maxScale, scale + step);
    applyScale(svgEl);
  });
  btnZoomOut.addEventListener("click", () => {
    scale = Math.max(minScale, scale - step);
    applyScale(svgEl);
  });
}

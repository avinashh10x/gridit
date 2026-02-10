/**
 * Gridly — Shared Geometry & Color Utilities
 * 
 * Helper functions used across all grid generators.
 * Runs inside the Illustrator UXP scripting context.
 */

const GridlyUtils = (() => {
  /**
   * Convert Illustrator bounds [left, top, right, bottom] to a rect object.
   * Note: In Illustrator, Y-axis is inverted (top > bottom in points).
   */
  function boundsToRect(bounds) {
    const [left, top, right, bottom] = bounds;
    return {
      x: left,
      y: top,
      width: right - left,
      height: top - bottom, // Illustrator Y is inverted
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      centerX: left + (right - left) / 2,
      centerY: bottom + (top - bottom) / 2
    };
  }

  /**
   * Create an RGBColor object for Illustrator.
   */
  function createRGBColor(r, g, b) {
    const color = new RGBColor();
    color.red = r;
    color.green = g;
    color.blue = b;
    return color;
  }

  /**
   * Default grid stroke color — neutral gray.
   */
  function gridColor() {
    return createRGBColor(136, 136, 136);
  }

  /**
   * Default clear space stroke color — slightly darker gray.
   */
  function clearSpaceColor() {
    return createRGBColor(102, 102, 102);
  }

  /**
   * Annotation/label color — red for visibility.
   */
  function annotationColor() {
    return createRGBColor(230, 60, 60);
  }

  /**
   * Convert opacity percentage (0-100) to Illustrator opacity (0-100).
   * Illustrator uses 0-100 scale directly.
   */
  function opacityToAI(percent) {
    return Math.max(0, Math.min(100, percent));
  }

  /**
   * Calculate the diagonal of a rectangle.
   */
  function diagonal(width, height) {
    return Math.sqrt(width * width + height * height);
  }

  /**
   * Clamp a value between min and max.
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  return {
    boundsToRect,
    createRGBColor,
    gridColor,
    clearSpaceColor,
    annotationColor,
    opacityToAI,
    diagonal,
    clamp
  };
})();

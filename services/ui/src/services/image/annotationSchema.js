/**
 * Annotation data model, validation, and path simplification utilities.
 *
 * All shape coordinates are stored as percentages (0-100) relative to
 * full image dimensions for responsive rendering at any viewport size.
 */

export const SHAPE_TYPES = {
  ARROW: 'arrow',
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  LINE: 'line',       // freehand
  TEXT: 'text',
};

export const DEFAULT_STROKE = '#ff0000';
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_FAMILY = 'sans-serif';
export const MAX_POINTS_PER_STROKE = 500;
export const SCHEMA_VERSION = 1;

/**
 * Create a new empty annotation data object.
 */
export function createAnnotationData() {
  return {
    version: SCHEMA_VERSION,
    shapes: [],
  };
}

/**
 * Create a unique shape ID.
 */
export function generateShapeId() {
  return `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new shape with defaults.
 */
export function createShape(type, props = {}) {
  return {
    id: generateShapeId(),
    type,
    x: 0,
    y: 0,
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    opacity: 1,
    rotation: 0,
    ...props,
  };
}

/**
 * Create an arrow shape.
 * points: [x1, y1, x2, y2] in percentage coords
 */
export function createArrow(points, props = {}) {
  return createShape(SHAPE_TYPES.ARROW, {
    points,
    ...props,
  });
}

/**
 * Create a rectangle shape.
 */
export function createRect(x, y, width, height, props = {}) {
  return createShape(SHAPE_TYPES.RECT, {
    x, y, width, height,
    fill: 'transparent',
    ...props,
  });
}

/**
 * Create an ellipse shape.
 */
export function createEllipse(x, y, radiusX, radiusY, props = {}) {
  return createShape(SHAPE_TYPES.ELLIPSE, {
    x, y, radiusX, radiusY,
    fill: 'transparent',
    ...props,
  });
}

/**
 * Create a freehand line shape.
 * points: flat array [x1, y1, x2, y2, ...] in percentage coords
 */
export function createLine(points, props = {}) {
  return createShape(SHAPE_TYPES.LINE, {
    points,
    ...props,
  });
}

/**
 * Create a text label shape.
 */
export function createText(x, y, text, props = {}) {
  return createShape(SHAPE_TYPES.TEXT, {
    x, y, text,
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: DEFAULT_FONT_FAMILY,
    fill: DEFAULT_STROKE,
    ...props,
  });
}

/**
 * Validate annotation data structure.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateAnnotationData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Annotation data must be an object'] };
  }

  if (data.version !== SCHEMA_VERSION) {
    errors.push(`Unsupported schema version: ${data.version}`);
  }

  if (!Array.isArray(data.shapes)) {
    errors.push('shapes must be an array');
    return { valid: false, errors };
  }

  const validTypes = Object.values(SHAPE_TYPES);
  for (const shape of data.shapes) {
    if (!shape.id) errors.push('Shape missing id');
    if (!validTypes.includes(shape.type)) {
      errors.push(`Invalid shape type: ${shape.type}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Douglas-Peucker path simplification algorithm.
 * Reduces number of points in a freehand path while preserving shape.
 *
 * @param {number[]} points - Flat array [x1, y1, x2, y2, ...]
 * @param {number} tolerance - Simplification tolerance (higher = more simplified)
 * @returns {number[]} Simplified flat point array
 */
export function simplifyPath(points, tolerance = 0.5) {
  if (points.length <= 4) return points; // 2 points or fewer, nothing to simplify

  // Convert flat array to point pairs
  const pts = [];
  for (let i = 0; i < points.length; i += 2) {
    pts.push({ x: points[i], y: points[i + 1] });
  }

  const simplified = douglasPeucker(pts, tolerance);

  // Convert back to flat array
  const result = [];
  for (const pt of simplified) {
    result.push(pt.x, pt.y);
  }
  return result;
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  const projX = lineStart.x + tClamped * dx;
  const projY = lineStart.y + tClamped * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Enforce maximum points limit on a freehand path.
 * Uses simplification with increasing tolerance until under limit.
 */
export function enforcePointLimit(points, maxPoints = MAX_POINTS_PER_STROKE) {
  const numPoints = points.length / 2;
  if (numPoints <= maxPoints) return points;

  let tolerance = 0.5;
  let simplified = simplifyPath(points, tolerance);

  while (simplified.length / 2 > maxPoints && tolerance < 50) {
    tolerance *= 1.5;
    simplified = simplifyPath(simplified, tolerance);
  }

  return simplified;
}

export default {
  SHAPE_TYPES,
  SCHEMA_VERSION,
  createAnnotationData,
  generateShapeId,
  createShape,
  createArrow,
  createRect,
  createEllipse,
  createLine,
  createText,
  validateAnnotationData,
  simplifyPath,
  enforcePointLimit,
};

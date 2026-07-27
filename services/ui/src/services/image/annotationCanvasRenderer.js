/**
 * Canvas2D annotation renderer for preview/shared view.
 * Draws annotation shapes from JSON data onto a canvas element.
 * All coordinates are percentages (0-100) converted to pixels based on canvas dimensions.
 */

import { SHAPE_TYPES } from './annotationSchema';

/**
 * Convert percentage coordinate to pixel value.
 */
function toPx(pct, dimension) {
  return (pct / 100) * dimension;
}

/**
 * Draw an arrow shape with arrowhead.
 */
function drawArrow(ctx, shape, width, height) {
  const points = shape.points;
  if (!points || points.length < 4) return;

  const x1 = toPx(points[0], width);
  const y1 = toPx(points[1], height);
  const x2 = toPx(points[2], width);
  const y2 = toPx(points[3], height);

  ctx.save();
  ctx.strokeStyle = shape.stroke || '#ff0000';
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = shape.opacity || 1;

  // Draw line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Draw arrowhead
  const headLength = shape.strokeWidth * 4 || 8;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.fillStyle = shape.stroke || '#ff0000';
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a rectangle shape.
 */
function drawRect(ctx, shape, width, height) {
  const x = toPx(shape.x, width);
  const y = toPx(shape.y, height);
  const w = toPx(shape.width, width);
  const h = toPx(shape.height, height);

  ctx.save();
  ctx.globalAlpha = shape.opacity || 1;

  if (shape.fill && shape.fill !== 'transparent') {
    ctx.fillStyle = shape.fill;
    ctx.fillRect(x, y, w, h);
  }

  ctx.strokeStyle = shape.stroke || '#ff0000';
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.strokeRect(x, y, w, h);

  ctx.restore();
}

/**
 * Draw an ellipse shape.
 */
function drawEllipse(ctx, shape, width, height) {
  const cx = toPx(shape.x, width);
  const cy = toPx(shape.y, height);
  const rx = toPx(shape.radiusX, width);
  const ry = toPx(shape.radiusY, height);

  ctx.save();
  ctx.globalAlpha = shape.opacity || 1;

  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);

  if (shape.fill && shape.fill !== 'transparent') {
    ctx.fillStyle = shape.fill;
    ctx.fill();
  }

  ctx.strokeStyle = shape.stroke || '#ff0000';
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a freehand line shape.
 */
function drawFreehand(ctx, shape, width, height) {
  const points = shape.points;
  if (!points || points.length < 4) return;

  ctx.save();
  ctx.strokeStyle = shape.stroke || '#ff0000';
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = shape.opacity || 1;

  ctx.beginPath();
  ctx.moveTo(toPx(points[0], width), toPx(points[1], height));

  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(toPx(points[i], width), toPx(points[i + 1], height));
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a text label shape.
 */
function drawText(ctx, shape, width, height) {
  const x = toPx(shape.x, width);
  const y = toPx(shape.y, height);

  ctx.save();
  ctx.globalAlpha = shape.opacity || 1;

  const fontSize = shape.fontSize || 16;
  const fontFamily = shape.fontFamily || 'sans-serif';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = shape.fill || shape.stroke || '#ff0000';
  ctx.textBaseline = 'top';
  ctx.fillText(shape.text || '', x, y);

  ctx.restore();
}

/**
 * Render all annotation shapes onto a canvas.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on
 * @param {Object} annotationData - Annotation data with { version, shapes }
 * @param {number} displayWidth - Display width of the canvas in pixels
 * @param {number} displayHeight - Display height of the canvas in pixels
 */
export function renderAnnotations(canvas, annotationData, displayWidth, displayHeight) {
  if (!canvas || !annotationData?.shapes?.length) return;

  // Set canvas resolution (handle HiDPI)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  for (const shape of annotationData.shapes) {
    switch (shape.type) {
      case SHAPE_TYPES.ARROW:
        drawArrow(ctx, shape, displayWidth, displayHeight);
        break;
      case SHAPE_TYPES.RECT:
        drawRect(ctx, shape, displayWidth, displayHeight);
        break;
      case SHAPE_TYPES.ELLIPSE:
        drawEllipse(ctx, shape, displayWidth, displayHeight);
        break;
      case SHAPE_TYPES.LINE:
        drawFreehand(ctx, shape, displayWidth, displayHeight);
        break;
      case SHAPE_TYPES.TEXT:
        drawText(ctx, shape, displayWidth, displayHeight);
        break;
    }
  }
}

export default { renderAnnotations };

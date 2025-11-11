/**
 * Splits `text` into chunks no longer than `chunkSize`, but never cuts
 * a word in half — it always breaks on the last whitespace or newline.
 *
 * @param {string} text
 * @param {number} chunkSize
 * @returns {string[]}
 */
export function chunkText(text, chunkSize) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    // Tentative end point
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      // Look backwards for the nearest space or newline
      const lastSpace   = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const splitPos    = Math.max(lastSpace, lastNewline);

      // If we found a break point after `start`, use it
      if (splitPos > start) {
        end = splitPos;
      }
    }

    // Extract the chunk, advance start
    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

/**
 * Find all code fence regions in the text to avoid splitting them
 * @param {string} text
 * @returns {Array<{start: number, end: number}>}
 * @deprecated Use MarkdownParser.findCodeRegions instead for better accuracy
 */
function findCodeFenceRegions(text) {
  const regions = [];
  const lines = text.split('\n');
  let inCodeFence = false;
  let fenceStart = 0;
  let currentPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentPos;
    const lineEnd = currentPos + line.length;

    // Check if this line starts/ends a code fence
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inCodeFence) {
        // Starting a code fence
        inCodeFence = true;
        fenceStart = lineStart;
      } else {
        // Ending a code fence
        inCodeFence = false;
        regions.push({
          start: fenceStart,
          end: lineEnd
        });
      }
    }

    // Move to next line (including newline character)
    currentPos = lineEnd + 1;
  }

  // If we're still in a code fence at the end, close it
  if (inCodeFence) {
    regions.push({
      start: fenceStart,
      end: text.length
    });
  }

  return regions;
}

/**
 * Splits `text` into chunks no longer than `chunkSize`, breaking only
 * on whitespace or newline. Returns objects with both the slice and its
 * original starting index. Ensures code fences are never split across chunks.
 *
 * @param {string} text
 * @param {number} chunkSize
 * @param {Array} [codeRegions] - Pre-computed code regions (optional, will compute if not provided)
 * @returns {{ text: string, offset: number, codeRegions: Array }[]}
 */
export function chunkTextWithOffsets(text, chunkSize, codeRegions = null) {
  const chunks = [];

  // Use provided code regions or fall back to legacy detection
  const allCodeRegions = codeRegions || findCodeFenceRegions(text);
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      // First, try to find a natural break point
      const lastSpace   = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const splitPos = Math.max(lastSpace, lastNewline);

      if (splitPos > start) {
        end = splitPos;
      }

      // Check if the proposed chunk would split a code region
      const wouldSplitRegion = allCodeRegions.some(region => {
        // A region is split if it starts before the end but extends past the end
        return region.start < end && region.end > end;
      });

      if (wouldSplitRegion) {
        // Find a code region that would be split
        const affectedRegion = allCodeRegions.find(region =>
          region.start < end && region.end > end
        );

        if (affectedRegion) {
          // If the region starts after our chunk start, end the chunk before the region
          if (affectedRegion.start >= start) {
            end = affectedRegion.start;
          } else {
            // If the region started before our chunk, include the entire region
            end = affectedRegion.end + 1; // +1 to include the newline after region
          }
        }
      }

      // Make sure we don't go backwards
      if (end <= start) {
        // If we can't split without breaking a region, include the whole region
        const containingRegion = allCodeRegions.find(region =>
          region.start <= start && region.end > start
        );
        if (containingRegion) {
          end = containingRegion.end + 1;
        } else {
          // Fallback: just advance by one character to avoid infinite loop
          end = start + 1;
        }
      }
    }

    // Ensure we don't exceed text length
    end = Math.min(end, text.length);

    // Get code regions that intersect with this chunk
    const chunkCodeRegions = allCodeRegions
      .filter(region =>
        // Region overlaps with the chunk
        region.start < end && region.end > start
      )
      .map(region => ({
        ...region,
        // Adjust positions relative to the chunk start
        start: Math.max(0, region.start - start),
        end: Math.min(end - start, region.end - start)
      }));

    chunks.push({
      text: text.slice(start, end),
      offset: start,
      codeRegions: chunkCodeRegions
    });
    start = end;
  }

  return chunks;
}
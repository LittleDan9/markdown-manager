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
 * @returns {{ text: string, offset: number }[]}
 */
export function chunkTextWithOffsets(text, chunkSize) {
  const chunks = [];
  const codeFenceRegions = findCodeFenceRegions(text);
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      // First, try to find a natural break point
      const lastSpace   = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      let splitPos = Math.max(lastSpace, lastNewline);
      
      if (splitPos > start) {
        end = splitPos;
      }
      
      // Check if the proposed chunk would split a code fence
      const wouldSplitFence = codeFenceRegions.some(region => {
        // A fence is split if it starts before the end but extends past the end
        return region.start < end && region.end > end;
      });
      
      if (wouldSplitFence) {
        // Find a code fence that would be split
        const affectedFence = codeFenceRegions.find(region => 
          region.start < end && region.end > end
        );
        
        if (affectedFence) {
          // If the fence starts after our chunk start, end the chunk before the fence
          if (affectedFence.start >= start) {
            end = affectedFence.start;
          } else {
            // If the fence started before our chunk, include the entire fence
            end = affectedFence.end + 1; // +1 to include the newline after fence
          }
        }
      }
      
      // Make sure we don't go backwards
      if (end <= start) {
        // If we can't split without breaking a fence, include the whole fence
        const containingFence = codeFenceRegions.find(region => 
          region.start <= start && region.end > start
        );
        if (containingFence) {
          end = containingFence.end + 1;
        } else {
          // Fallback: just advance by one character to avoid infinite loop
          end = start + 1;
        }
      }
    }

    // Ensure we don't exceed text length
    end = Math.min(end, text.length);

    chunks.push({
      text: text.slice(start, end),
      offset: start
    });
    start = end;
  }

  return chunks;
}
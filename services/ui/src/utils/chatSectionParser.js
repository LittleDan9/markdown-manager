/**
 * Parse LLM response text into logical sections separated by thematic breaks (---).
 * Client-side mirror of backend section_parser.py for fallback use.
 *
 * @param {string} text - Raw markdown response text
 * @returns {Array<{type: string, label: string, content: string, confidence: number}>}
 */

const THEMATIC_BREAK = /^\s*-{3,}\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/**
 * Split text on `---` lines that are NOT inside fenced code blocks.
 */
function splitOnBreaks(text) {
  const lines = text.split("\n");
  const sections = [];
  let currentLines = [];
  let inFence = false;
  let fenceChar = null;

  for (const line of lines) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const char = fenceMatch[1][0]; // '`' or '~'
      if (!inFence) {
        inFence = true;
        fenceChar = char;
      } else if (char === fenceChar) {
        inFence = false;
        fenceChar = null;
      }
      currentLines.push(line);
      continue;
    }

    if (!inFence && THEMATIC_BREAK.test(line)) {
      sections.push(currentLines.join("\n"));
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.length) {
    sections.push(currentLines.join("\n"));
  }

  return sections;
}

/**
 * Return confidence (0–1) that text is a follow-up questions section.
 */
function questionConfidence(text) {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return 0;

  const questionLines = lines.filter((l) => l.endsWith("?")).length;
  const ratio = questionLines / lines.length;

  if (ratio >= 0.6) return Math.min(1.0, 0.5 + ratio * 0.5);
  return Math.round(ratio * 0.5 * 100) / 100;
}

function makeSection(type, label, content, confidence) {
  return {
    type,
    label,
    content: content.trim(),
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Assign type/label/confidence to an ordered list of raw section texts.
 */
function classifySections(sections) {
  const totalChars = sections.reduce((sum, s) => sum + s.length, 0);
  const results = [];

  for (let idx = 0; idx < sections.length; idx++) {
    const content = sections[idx];
    const isFirst = idx === 0;
    const isLast = idx === sections.length - 1;

    // Follow-up detection (last section)
    if (isLast) {
      const qConf = questionConfidence(content);
      if (qConf >= 0.5) {
        results.push(makeSection("follow_up", "Follow-up questions", content, qConf));
        continue;
      }
    }

    // Context detection (first section)
    if (isFirst) {
      const ratio = totalChars ? content.length / totalChars : 0;
      if (ratio < 0.35) {
        const confidence = Math.min(1.0, 0.6 + (0.35 - ratio));
        results.push(makeSection("context", "Context", content, confidence));
        continue;
      }
    }

    // Default: primary content
    results.push(makeSection("primary_content", "Content", content, 0.9));
  }

  return results;
}

/**
 * Parse response text into classified sections.
 *
 * @param {string} text - Raw markdown response text
 * @returns {Array<{type: string, label: string, content: string, confidence: number}>}
 */
export function parseSections(text) {
  if (!text || !text.trim()) return [];

  const sectionsRaw = splitOnBreaks(text)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!sectionsRaw.length) return [];

  if (sectionsRaw.length === 1) {
    return [makeSection("primary_content", "Content", sectionsRaw[0], 1.0)];
  }

  return classifySections(sectionsRaw);
}

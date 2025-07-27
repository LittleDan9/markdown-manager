
import nspell from 'nspell';

let speller = null;
let customWordSet = new Set();
let affData = null;
let dicData = null;

async function loadDictionary() {
  if (speller) return;
  if (!affData) {
    const affResponse = await fetch('/dictionary/index.aff');
    affData = await affResponse.text();
  }
  if (!dicData) {
    const dicResponse = await fetch('/dictionary/index.dic');
    dicData = await dicResponse.text();
  }
  speller = nspell(affData, dicData);
}

function addCustomWords(words) {
  customWordSet = new Set();
  if (!speller || !Array.isArray(words)) return;
  words.forEach(word => {
    if (word && typeof word === 'string') {
      speller.add(word.trim());
      customWordSet.add(word.trim().toLowerCase());
    }
  });
}

function extractMarkdownTextContent(text) {
  // Track code fence and inline code regions for skipping
  let codeFenceRegions = [];
  let inlineCodeRegions = [];
  let codeFenceRegex = /```[\s\S]*?```/g;
  let inlineCodeRegex = /`[^`\n]*`/g;
  let match;
  while ((match = codeFenceRegex.exec(text)) !== null) {
    codeFenceRegions.push({ start: match.index, end: match.index + match[0].length });
  }
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    inlineCodeRegions.push({ start: match.index, end: match.index + match[0].length });
  }
  return { originalText: text, codeFenceRegions, inlineCodeRegions };
}

self.onmessage = async function(e) {
  const { text, customWords, requestId } = e.data;
  await loadDictionary();
  addCustomWords(customWords);
  // Refined chunking: break at last whitespace/newline before chunkSize
  const chunkSize = 2000;
  let chunkStarts = [0];
  let pos = 0;
  while (pos < text.length) {
    let next = pos + chunkSize;
    if (next >= text.length) break;
    // Scan backward to find last whitespace/newline before chunkSize
    let boundary = next;
    while (boundary > pos && !/\s|\n/.test(text[boundary])) boundary--;
    // If no whitespace found before chunkSize, scan forward
    if (boundary === pos) {
      boundary = next;
      while (boundary < text.length && !/\s|\n/.test(text[boundary])) boundary++;
      if (boundary === text.length) break;
    }
    chunkStarts.push(boundary);
    pos = boundary;
  }
  chunkStarts.push(text.length);
  const totalChunks = chunkStarts.length - 1;
  let issues = [];

  function processChunk(chunkIndex) {
    const start = chunkStarts[chunkIndex];
    const end = chunkStarts[chunkIndex + 1];
    const chunkText = text.slice(start, end);
    // Get code fence and inline code regions for the full document
    const { codeFenceRegions, inlineCodeRegions } = extractMarkdownTextContent(text);
    // Calculate starting line number for this chunk
    const chunkStartText = text.slice(0, start);
    const chunkStartLine = chunkStartText.split('\n').length;
    const regex = /\b[A-Za-z']+\b/g;
    let match;
    let chunkIssues = 0;
    while ((match = regex.exec(chunkText)) !== null) {
      const word = match[0];
      const globalOffset = start + match.index;
      // Skip words inside code fence or inline code regions (using global offsets)
      if (codeFenceRegions.some(region => globalOffset >= region.start && globalOffset < region.end)) continue;
      if (inlineCodeRegions.some(region => globalOffset >= region.start && globalOffset < region.end)) continue;
      // For each line, skip markdown tokens at the start
      const upTo = chunkText.slice(0, match.index);
      const lines = upTo.split('\n');
      const currentLine = lines[lines.length - 1];
      // If word is at the start of the line and matches markdown token, skip
      if (/^(\s*(#{1,6}|---|\*\*\*|\*{3,}|_{3,}|>+|[-*+]\s+|\d+\.\s+))/.test(currentLine)) {
        // If the word is part of the markdown token, skip
        const tokenMatch = currentLine.match(/^(\s*(#{1,6}|---|\*\*\*|\*{3,}|_{3,}|>+|[-*+]\s+|\d+\.\s+))/);
        if (tokenMatch && match.index < (upTo.length + tokenMatch[0].length)) continue;
      }
      // Skip custom dictionary words (case-insensitive, match all forms)
      if (customWordSet.has(word.trim().toLowerCase())) continue;
      if (customWordSet.has(word.trim()) ||
          customWordSet.has(word.trim().toUpperCase()) ||
          customWordSet.has(word.trim()[0].toUpperCase() + word.trim().slice(1).toLowerCase())) continue;
      if (!speller.correct(word)) {
        const suggestions = speller.suggest(word);
        // Compute line/column in chunk
        const upToGlobal = text.slice(0, globalOffset);
        const linesGlobal = upToGlobal.split('\n');
        const lineNumber = linesGlobal.length;
        const column = linesGlobal[linesGlobal.length - 1].length + 1;
        issues.push({ word, suggestions, lineNumber, column, offset: globalOffset });
        chunkIssues++;
      }
    }
    // Debug: log issues found in this chunk
    if (chunkIssues > 0) {
      // console.log(`[SpellWorker] Chunk ${chunkIndex + 1}/${totalChunks}: Found ${chunkIssues} issues.`);
      if (issues.length > 0) {
        const sample = issues[issues.length - 1];
        // console.log(`[SpellWorker] Sample issue:`, sample);
      }
    }
    // Report progress
    self.postMessage({
      type: 'progress',
      requestId,
      progress: (chunkIndex + 1) / totalChunks,
      currentChunk: chunkIndex + 1,
      totalChunks
    });
    if (chunkIndex + 1 < totalChunks) {
      setTimeout(() => processChunk(chunkIndex + 1), 10);
    } else {
      // console.log(`[SpellWorker] Spell check complete. Total issues: ${issues.length}`);
      if (issues.length > 0) {
        // console.log(`[SpellWorker] First issue:`, issues[0]);
        // console.log(`[SpellWorker] Last issue:`, issues[issues.length - 1]);
      }
      self.postMessage({ type: 'complete', requestId, issues });
    }
  }
  processChunk(0);
};

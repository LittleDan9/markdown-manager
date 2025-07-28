
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
  const { chunk, customWords, requestId } = e.data;
  await loadDictionary();
  addCustomWords(customWords);
  // chunk: { text, startOffset, endOffset }
  const { text, startOffset } = chunk;
  let issues = [];
  // Get code fence and inline code regions for the chunk (or pass full doc if needed)
  // For now, just use chunk text
  const { codeFenceRegions, inlineCodeRegions } = extractMarkdownTextContent(text);
  const regex = /\b[A-Za-z']+\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const word = match[0];
    const globalOffset = startOffset + match.index;
    // Skip words inside code fence or inline code regions (using chunk offsets)
    if (codeFenceRegions.some(region => match.index >= region.start && match.index < region.end)) continue;
    if (inlineCodeRegions.some(region => match.index >= region.start && match.index < region.end)) continue;
    // For each line, skip markdown tokens at the start
    const upTo = text.slice(0, match.index);
    const lines = upTo.split('\n');
    const currentLine = lines[lines.length - 1];
    if (/^(\s*(#{1,6}|---|\*\*\*|\*{3,}|_{3,}|>+|[-*+]\s+|\d+\.\s+))/.test(currentLine)) {
      const tokenMatch = currentLine.match(/^(\s*(#{1,6}|---|\*\*\*|\*{3,}|_{3,}|>+|[-*+]\s+|\d+\.\s+))/);
      if (tokenMatch && match.index < (upTo.length + tokenMatch[0].length)) continue;
    }
    if (customWordSet.has(word.trim().toLowerCase())) continue;
    if (customWordSet.has(word.trim()) ||
        customWordSet.has(word.trim().toUpperCase()) ||
        customWordSet.has(word.trim()[0].toUpperCase() + word.trim().slice(1).toLowerCase())) continue;
    if (!speller.correct(word)) {
      const suggestions = speller.suggest(word);
      // Compute line/column in chunk
      const upToGlobal = text.slice(0, match.index);
      const linesGlobal = upToGlobal.split('\n');
      const lineNumber = linesGlobal.length;
      const column = linesGlobal[linesGlobal.length - 1].length + 1;
      issues.push({ word, suggestions, lineNumber, column, offset: globalOffset });
    }
  }
  self.postMessage({ type: 'spellCheckChunkResult', requestId, issues });
};

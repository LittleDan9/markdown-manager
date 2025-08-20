
// Use dynamic import to avoid webpack bundling conflicts with web workers
let nspell = null;
let speller = null;
let customWordSet = new Set();
let affData = null;
let dicData = null;

async function loadDictionary() {
  if (speller) return;
  try {
    if (!affData) {
      const affResponse = await fetch('/dictionary/index.aff');
      affData = await affResponse.text();
    }
    if (!dicData) {
      const dicResponse = await fetch('/dictionary/index.dic');
      dicData = await dicResponse.text();
    }
    speller = nspell(affData, dicData);
  } catch (err) {
    console.error('[SpellCheckWorker] Error loading dictionary:', err);
    throw err;
  }
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
  
  // Simple and robust code fence detection
  // Since chunks now respect fence boundaries, we can use simpler logic
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
        codeFenceRegions.push({ 
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
    codeFenceRegions.push({ 
      start: fenceStart, 
      end: text.length 
    });
  }
  
  // Also match indented code blocks (4+ spaces at start of line)
  let indentedCodeRegex = /^(?: {4,}|\t+).*$/gm;
  let match;
  while ((match = indentedCodeRegex.exec(text)) !== null) {
    codeFenceRegions.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Find inline code
  let inlineCodeRegex = /`[^`\n]*`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    inlineCodeRegions.push({ start: match.index, end: match.index + match[0].length });
  }
  
  return { originalText: text, codeFenceRegions, inlineCodeRegions };
}

self.onmessage = async function (e) {
  try {
    if (e.data.type !== 'spellCheckChunk'){
      console.warn('[SpellCheckWorker unknown message type');
      return;
    }
    const { chunk, customWords, requestId } = e.data;
    await loadDictionary();
    addCustomWords(customWords);
    // chunk: { text, startOffset, endOffset }
    const { text, startOffset } = chunk;
    let issues = [];
    // Get code fence and inline code regions for the chunk
    const { codeFenceRegions, inlineCodeRegions } = extractMarkdownTextContent(text);
    
    const regex = /\b[A-Za-z']+\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      const globalOffset = startOffset + match.index;
      
      // Skip words inside code fence or inline code regions
      if (codeFenceRegions.some(region => match.index >= region.start && match.index < region.end)) continue;
      if (inlineCodeRegions.some(region => match.index >= region.start && match.index < region.end)) continue;
      
      // Enhanced markdown token detection - skip words that are part of markdown syntax
      const upTo = text.slice(0, match.index);
      const lines = upTo.split('\n');
      const currentLine = lines[lines.length - 1];
      const lineStart = match.index - currentLine.length;
      const wordEndInLine = match.index + word.length - lineStart;
      
      // Skip if word is in markdown headers, lists, or other special syntax
      if (/^(\s*(#{1,6}\s+|---+\s*$|\*\*\*+\s*$|\*{3,}\s*$|_{3,}\s*$|>+\s+|[-*+]\s+|\d+\.\s+|\|\s*))/.test(currentLine)) {
        const tokenMatch = currentLine.match(/^(\s*(#{1,6}\s+|---+\s*$|\*\*\*+\s*$|\*{3,}\s*$|_{3,}\s*$|>+\s+|[-*+]\s+|\d+\.\s+|\|\s*))/);
        if (tokenMatch && wordEndInLine <= tokenMatch[0].length) continue;
      }
      
      // Skip words that are URLs or email addresses
      if (/^https?:\/\/|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(word)) continue;
      
      // Check if this word is part of an email address by looking at surrounding context
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + word.length + 50);
      const context = text.slice(contextStart, contextEnd);
      const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;
      const emailMatch = context.match(emailRegex);
      if (emailMatch && context.indexOf(word) >= context.indexOf(emailMatch[0]) && 
          context.indexOf(word) < context.indexOf(emailMatch[0]) + emailMatch[0].length) {
        continue;
      }
      
      // Skip words that are part of HTML tags
      const beforeWord = text.slice(Math.max(0, match.index - 10), match.index);
      const afterWord = text.slice(match.index + word.length, Math.min(text.length, match.index + word.length + 10));
      if (/<[^>]*$/.test(beforeWord) && /^[^<]*>/.test(afterWord)) continue;
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
  } catch (err) {
    console.error('[SpellCheckWorker] Error:', err);
    self.postMessage({ type: 'spellCheckChunkError', requestId, error: err.message });
  }
};

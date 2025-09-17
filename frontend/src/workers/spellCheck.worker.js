
import nspellModule from 'nspell';
const nspell = nspellModule.default || nspellModule;
let speller = null;
let customWordSet = new Set();
let affData = null;
let dicData = null;

async function loadDictionary() {
    if (speller) return;
    try {
      if (!affData) {
        // Use self.location to get the correct base URL in worker context
        const baseUrl = self.location.origin;
        const affResponse = await fetch(`${baseUrl}/dictionary/index.aff`);
        if (!affResponse.ok) {
          throw new Error(`Failed to load .aff file: ${affResponse.status} ${affResponse.statusText}`);
        }
        affData = await affResponse.text();
      }
      if (!dicData) {
        const baseUrl = self.location.origin;
        const dicResponse = await fetch(`${baseUrl}/dictionary/index.dic`);
        if (!dicResponse.ok) {
          throw new Error(`Failed to load .dic file: ${dicResponse.status} ${dicResponse.statusText}`);
        }
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
      const trimmedWord = word.trim();
      // Add to nspell dictionary (this handles multiple forms internally)
      speller.add(trimmedWord);
      // Add all possible forms to our set for fast checking
      customWordSet.add(trimmedWord.toLowerCase());
      customWordSet.add(trimmedWord);
      customWordSet.add(trimmedWord.toUpperCase());
      if (trimmedWord.length > 1) {
        customWordSet.add(trimmedWord[0].toUpperCase() + trimmedWord.slice(1).toLowerCase());
      }
    }
  });
}

self.onmessage = async function (e) {
  let requestId;
  try {
    const { requestId: rid, type, chunk, customWords } = e.data || {};
    requestId = rid;

    if (type !== 'spellCheckChunk'){
      console.warn('[SpellCheckWorker] Unknown message type:', type);
      return;
    }

    await loadDictionary();
    addCustomWords(customWords);

    // chunk: { text, startOffset, codeRegions }
    const { text, startOffset, codeRegions = [] } = chunk;
    let issues = [];
    const seen = new Set();

    const regex = /\b[A-Za-z']+\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      const wordStart = match.index;
      const wordEnd = wordStart + word.length;
      const globalOffset = startOffset + wordStart;
      const dedupKey = word + ':' + globalOffset;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      // Skip words inside pre-computed code regions (no re-parsing needed!)
      if (codeRegions.some(region =>
        wordStart >= region.start && wordEnd <= region.end
      )) {
        continue;
      }

      // Enhanced markdown token detection - skip words that are part of markdown syntax
      const upTo = text.slice(0, match.index);
      const lines = upTo.split('\n');
      const currentLine = lines[lines.length - 1];
      const lineStart = match.index - currentLine.length;
      const wordEndInLine = match.index + word.length - lineStart;

      // Skip if word is in markdown headers, lists, or other special syntax
      if (/^(\s*(#{1,6}\s+|---+\s*$|\*\*\*+\s*$|\*{3,}\s*$|_{3,}\s*$|>+\s+|[-*+]\s+|\d+\.\s+|\|\s*))/ .test(currentLine)) {
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

      // Check if word is in custom dictionary (fast check using our set)
      if (customWordSet.has(word.trim())) continue;

      // Check if word is correct according to main speller
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
    self.postMessage({
      type: 'spellCheckChunkError',
      requestId: requestId || 'unknown',
      error: err.message
    });
  }
};

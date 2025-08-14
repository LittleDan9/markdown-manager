// src/utils/editorHelpers.js
import * as monaco from 'monaco-editor';
import SpellCheckService from '../services/SpellCheckService';
import { chunkTextWithOffsets } from './chunkText'; // if you need it
import DictionaryService from '@/services/DictionaryService';

/**
 * Compute the changed region between prevValue and newValue, using the editor's selection/cursor if available.
 * - If prevValue is empty, scan the whole doc.
 * - If only a small region changed, scan from a few words before the change to the end of the line.
 * - If editor is provided, use its selection/cursor to refine the region.
 * Returns { regionText, startOffset } for spell checking.
 */
export function getChangedRegion(editor, prevValue, newValue, fullTextThreshold = 2000) {
  if (!prevValue || prevValue.length === 0) {
    // Full scan if no previous value
    return { regionText: newValue, startOffset: 0 };
  }
  if (prevValue === newValue) {
    return { regionText: '', startOffset: 0 };
  }

  // For small documents, always do full scan to avoid positioning issues
  if (newValue.length <= fullTextThreshold) {
    return { regionText: newValue, startOffset: 0 };
  }

  // Find first and last changed indices
  let start = 0;
  let endPrev = prevValue.length;
  let endNew = newValue.length;
  while (start < endPrev && start < endNew && prevValue[start] === newValue[start]) {
    start++;
  }

  // Find end of change (from end)
  let tailPrev = endPrev - 1;
  let tailNew = endNew - 1;
  while (tailPrev >= start && tailNew >= start && prevValue[tailPrev] === newValue[tailNew]) {
    tailPrev--;
    tailNew--;
  }

  // Expand to word boundaries and line boundaries for better context
  let scanStart = start;
  let scanEnd = tailNew + 1;

  // Expand start to beginning of paragraph or sentence
  while (scanStart > 0 && !/[\n\r]/.test(newValue[scanStart - 1])) {
    scanStart--;
  }

  // Expand end to end of paragraph or sentence
  while (scanEnd < newValue.length && !/[\n\r]/.test(newValue[scanEnd])) {
    scanEnd++;
  }

  // If editor is available, expand to include the visible area around cursor
  if (editor && typeof editor.getSelection === 'function') {
    const sel = editor.getSelection();
    if (sel) {
      const model = editor.getModel();
      const startPos = sel.getStartPosition();
      const endPos = sel.getEndPosition();

      // Expand to include a few lines around the cursor for context
      const expandLines = 3;
      const expandStartLine = Math.max(1, startPos.lineNumber - expandLines);
      const expandEndLine = Math.min(model.getLineCount(), endPos.lineNumber + expandLines);

      const selStartOffset = model.getOffsetAt({ lineNumber: expandStartLine, column: 1 });
      const selEndOffset = model.getOffsetAt({ lineNumber: expandEndLine, column: model.getLineMaxColumn(expandEndLine) });

      // Use the expanded selection if it makes sense
      scanStart = Math.min(scanStart, selStartOffset);
      scanEnd = Math.max(scanEnd, selEndOffset);
    }
  }

  // Ensure we don't exceed document bounds
  scanStart = Math.max(0, scanStart);
  scanEnd = Math.min(newValue.length, scanEnd);

  // If the region is still large relative to the document, just scan the whole thing
  const regionSize = scanEnd - scanStart;
  if (regionSize > fullTextThreshold * 0.7) {
    return { regionText: newValue, startOffset: 0 };
  }

  return { regionText: newValue.slice(scanStart, scanEnd), startOffset: scanStart };
}

/**
 * 2) Given raw issues from SpellCheckService.scan():
 *    - map each issue.offset → global offset
 *    - compute line/column + build Monaco markers
 *    - filter out old markers in the same region
 *    - update & return the new suggestionsMap
 */
export function toMonacoMarkers(
  editor,
  issues,
  startOffset,
  prevSuggestionsMap = new Map()
) {
  const model = editor.getModel();
  const oldMarkers = monaco.editor.getModelMarkers({ resource: model.uri })
    .filter(m => m.owner === 'spell');
  const newMarkers = [];
  const newSuggestions = new Map();

  // If startOffset is 0, we're doing a full document scan - clear all old markers
  let filteredOld = [];
  if (startOffset === 0) {
    // Full document scan - clear all spell markers
    filteredOld = [];
    newSuggestions.clear();
  } else {
    // Regional scan - calculate the actual region bounds more carefully
    let regionEndOffset = startOffset;
    if (issues.length > 0) {
      regionEndOffset = Math.max(
        ...issues.map(i => startOffset + i.offset + (i.word ? i.word.length : 0))
      );
    }

    // Keep markers outside the scanned region
    filteredOld = oldMarkers.filter(m => {
      const markerStart = model.getOffsetAt({ lineNumber: m.startLineNumber, column: m.startColumn });
      const markerEnd = model.getOffsetAt({ lineNumber: m.endLineNumber, column: m.endColumn });
      return markerEnd < startOffset || markerStart > regionEndOffset;
    });

    // Preserve suggestions for markers we're keeping
    filteredOld.forEach(m => {
      const key = `${m.startLineNumber}:${m.startColumn}`;
      if (prevSuggestionsMap.has(key)) {
        newSuggestions.set(key, prevSuggestionsMap.get(key));
      }
    });
  }

  // build fresh markers + suggestion map for new issues
  for (const issue of issues) {
    try {
      const globalOffset = startOffset + issue.offset;
      const pos = model.getPositionAt(globalOffset);
      const wordLength = issue.word ? issue.word.length : 1;
      const msg = `"${issue.word}" — ${issue.suggestions?.slice(0, 3).join(', ') || 'no suggestions'}`;

      newMarkers.push({
        owner: 'spell',
        severity: monaco.MarkerSeverity.Warning,
        message: msg,
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column + wordLength,
      });

      const key = `${pos.lineNumber}:${pos.column}`;
      newSuggestions.set(key, issue.suggestions || []);
    } catch (error) {
      console.warn('Error creating marker for spell issue:', error, issue);
    }
  }

  // apply combined markers
  monaco.editor.setModelMarkers(
    model,
    'spell',
    filteredOld.concat(newMarkers)
  );

  return newSuggestions;
}

/**
 * 3) Wire up Monaco “quick fix” code actions for each spell marker:
 *    - “Replace with…” suggestions
 *    - “Add to dictionary”
 */
export function registerQuickFixActions(editor, suggestionsMapRef, categoryId = null) {
  const disposables = [];

  // code action provider
  disposables.push(monaco.languages.registerCodeActionProvider('markdown', {
    provideCodeActions(model, range) {
      const wordInfo = model.getWordAtPosition(range.getStartPosition())
      if (!wordInfo || !wordInfo.word) return { actions: [], dispose: () => { } };
      const trueRange = new monaco.Range(
        range.startLineNumber,
        wordInfo.startColumn,
        range.endLineNumber,
        wordInfo.startColumn + wordInfo.word.length
      );
      const wordKey = `${range.startLineNumber}:${wordInfo.startColumn}`;
      let suggestions = suggestionsMapRef.current.get(wordKey);
      let key = wordKey;
      // Fallback: legacy scan if still not found
      if (!suggestions) {
        const pos = range.getStartPosition();
        const lineContent = model.getLineContent(pos.lineNumber);
        let scanCol = pos.column - 1; // Monaco columns are 1-based
        while (scanCol > 0 && /\S/.test(lineContent[scanCol - 1])) {
          scanCol--;
        }
        if (scanCol > 0 && scanCol < pos.column) {
          const fallbackKey = `${pos.lineNumber}:${scanCol}`;
          suggestions = suggestionsMapRef.current.get(fallbackKey);
          if (suggestions) {
            key = fallbackKey;
          }
        }


      }
      if (!suggestions) return { actions: [], dispose: () => { } };



      const actions = suggestions.map((word, idx) => ({
        title: `${word}`,
        kind: 'quickfix',
        edit: {
          edits: [{
            resource: model.uri,
            textEdit: {
              range: trueRange,
              text: word
            }
          }]
        },
        diagnostics: [],
        isPreferred: idx === 0,
        command: {
          id: 'spell.checkRegion',
          title: 'Spell Check Region',
          arguments: [trueRange, editor]
        }
      }));

      // add “Add to dictionary” last, pass editor and suggestionsMapRef (ref object) as arguments
      actions.push({
        title: `Add ${wordInfo.word}`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToDictionary',
          title: 'Add to dictionary',
          // Only pass the Monaco editor instance, never a ref or DOM node
          arguments: [key, range, editor, suggestionsMapRef, categoryId]
        }
      });

      return { actions, dispose: () => { } };
    }
  }));

  // Register the command globally only once
  if (!monaco.editor._spellAddToDictionaryRegistered) {
    monaco.editor.registerCommand('spell.addToDictionary', (accessor, ...args) => {
      // args: [key, range, editor, suggestionsMapRef, categoryId]
      const [key, range, editorInstance, suggestionsMapRefArg, categoryId] = args;
      if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
        console.error('spell.addToDictionary: Invalid editor instance passed:', editorInstance);
        return;
      }

      const model = editorInstance.getModel();
      const wordInfo = model.getWordAtPosition(range.getStartPosition())
      if (!wordInfo || !wordInfo.word) return;

      // Add word to the appropriate dictionary scope
      if (categoryId) {
        DictionaryService.addCategoryWord(categoryId, wordInfo.word);
      } else {
        DictionaryService.addCustomWord(wordInfo.word);
      }

      suggestionsMapRefArg.current.delete(key);

      // Run a full document scan to update all markers for the new dictionary word
      const fullText = model.getValue();
      SpellCheckService.scan(fullText, () => {}, categoryId).then(issues => {
        toMonacoMarkers({ getModel: () => model }, issues, 0);
      });
    });
    monaco.editor._spellAddToDictionaryRegistered = true;
  }

  if (!monaco.editor._spellCheckRegionRegistered) {
    monaco.editor.registerCommand('spell.checkRegion', (accessor, ...args) => {
      const [range, editorInstance, categoryId] = args;
      const model = editorInstance.getModel();
      const lineNumber = range.startLineNumber;
      const lineContent = model.getLineContent(lineNumber);
      const regionText = lineContent.slice(range.startColumn - 1);
      const startOffset = model.getOffsetAt({ lineNumber, column: 0 });
      SpellCheckService.scan(lineContent, () => {}, categoryId).then(issues => {
        toMonacoMarkers({ getModel: () => model }, issues, startOffset);
      });
    });
    monaco.editor._spellCheckRegionRegistered = true;
  }

  // clean up if needed
  return () => disposables.forEach(d => d.dispose && d.dispose());
}
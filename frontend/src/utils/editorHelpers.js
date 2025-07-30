// src/utils/editorHelpers.js
import * as monaco from 'monaco-editor';
import SpellCheckService from '../services/SpellCheckService';
import { chunkTextWithOffsets } from './chunkText'; // if you need it

/**
 * Compute the changed region between prevValue and newValue, using the editor's selection/cursor if available.
 * - If prevValue is empty, scan the whole doc.
 * - If only a small region changed, scan from a few words before the change to the end of the line.
 * - If editor is provided, use its selection/cursor to refine the region.
 * Returns { regionText, startOffset } for spell checking.
 */
export function getChangedRegion(editor, prevValue, newValue, fullTextThreshold = 1000) {
  if (!prevValue || prevValue.length === 0) {
    // Full scan if no previous value
    return { regionText: newValue, startOffset: 0 };
  }
  if (prevValue === newValue) {
    return { regionText: '', startOffset: 0 };
  }

  // Find first and last changed indices
  let start = 0;
  let endPrev = prevValue.length;
  let endNew = newValue.length;
  while (start < endPrev && start < endNew && prevValue[start] === newValue[start]) {
    start++;
  }
  // If only appended, scan from start to end of new text
  if (start === endPrev && endNew > endPrev) {
    return { regionText: newValue.slice(start), startOffset: start };
  }
  // Find end of change (from end)
  let tailPrev = endPrev - 1;
  let tailNew = endNew - 1;
  while (tailPrev >= start && tailNew >= start && prevValue[tailPrev] === newValue[tailNew]) {
    tailPrev--;
    tailNew--;
  }
  // Expand start to previous word boundary
  let scanStart = start;
  while (scanStart > 0 && /\w/.test(newValue[scanStart - 1])) {
    scanStart--;
  }
  // Expand end to end of line
  let scanEnd = tailNew + 1;
  while (scanEnd < newValue.length && newValue[scanEnd] !== '\n') {
    scanEnd++;
  }

  // If editor is available, use its selection/cursor to further refine the region
  if (editor && typeof editor.getSelection === 'function') {
    const sel = editor.getSelection();
    if (sel) {
      const model = editor.getModel();
      const startPos = sel.getStartPosition();
      const endPos = sel.getEndPosition();
      const selStartOffset = model.getOffsetAt({ lineNumber: startPos.lineNumber, column: 1 });
      const selEndOffset = model.getOffsetAt({ lineNumber: endPos.lineNumber + 1, column: 1 }) - 1;
      // Expand region to include selection if it overlaps
      scanStart = Math.min(scanStart, selStartOffset);
      scanEnd = Math.max(scanEnd, selEndOffset);
    }
  }

  // If the region is large or the doc is small, scan the whole doc
  if (newValue.length <= fullTextThreshold || scanEnd - scanStart > fullTextThreshold) {
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
  const model          = editor.getModel();
  const oldMarkers     = monaco.editor.getModelMarkers({ resource: model.uri })
    .filter(m => m.owner === 'spell');
  const newMarkers     = [];
  const newSuggestions = new Map();

  // clear out any old spell markers within [startOffset … end]
  const regionEndOffset = startOffset + issues.reduce((max, i) => Math.max(max, i.offset), 0) + 1;
  const filteredOld = oldMarkers.filter(m => {
    const s = model.getOffsetAt({ lineNumber: m.startLineNumber, column: m.startColumn });
    const e = model.getOffsetAt({ lineNumber: m.endLineNumber,   column: m.endColumn });
    return e < startOffset || s > regionEndOffset;
  });

  // build fresh markers + suggestion map
  for (const issue of issues) {
    const globalOffset = startOffset + issue.offset;
    const pos          = model.getPositionAt(globalOffset);
    const msg          = `"${issue.word}" — ${issue.suggestions?.slice(0,3).join(', ') || 'no suggestions'}`;

    newMarkers.push({
      owner: 'spell',
      severity: monaco.MarkerSeverity.Warning,
      message: msg,
      startLineNumber: pos.lineNumber,
      startColumn: pos.column,
      endLineNumber: pos.lineNumber,
      endColumn: pos.column + issue.word.length,
    });

    newSuggestions.set(`${pos.lineNumber}:${pos.column}`, issue.suggestions || []);
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
export function registerQuickFixActions(editor, suggestionsMapRef) {
  const disposables = [];

  // code action provider
  disposables.push(monaco.languages.registerCodeActionProvider('javascript', {
    provideCodeActions(model, range) {
      const key = `${range.startLineNumber}:${range.startColumn}`;
      const suggestions = suggestionsMapRef.current.get(key);
      if (!suggestions?.length) return { actions: [], dispose: () => {} };

      const actions = suggestions.map((word, idx) => ({
        title: `Replace with "${word}"`,
        kind: 'quickfix',
        edit: {
          edits: [{
            resource: model.uri,
            edit: {
              range,
              text: word
            }
          }]
        },
        diagnostics: [],
        isPreferred: idx === 0
      }));

      // add “Add to dictionary” last, pass editor and suggestionsMapRef (ref object) as arguments
      actions.push({
        title: 'Add to dictionary',
        kind: 'quickfix',
        command: {
          id: 'spell.addToDictionary',
          title: 'Add to dictionary',
          // Only pass the Monaco editor instance, never a ref or DOM node
          arguments: [key, range, editor, suggestionsMapRef]
        }
      });

      return { actions, dispose: () => {} };
    }
  }));

  // Register the command globally only once
  if (!monaco.editor._spellAddToDictionaryRegistered) {
    monaco.editor.registerCommand('spell.addToDictionary', (accessor, ...args) => {
      // args: [key, range, editor, suggestionsMapRef]
      const [key, range, editorInstance, suggestionsMapRefArg] = args;
      if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
        console.error('spell.addToDictionary: Invalid editor instance passed:', editorInstance);
        return;
      }
      const [line, col] = key.split(':').map(Number);
      const model = editorInstance.getModel();
      const word = model.getValueInRange(range);
      SpellCheckService.addCustomWord(word);
      suggestionsMapRefArg.current.delete(key);
      // Optionally, trigger a UI update if needed
    });
    monaco.editor._spellAddToDictionaryRegistered = true;
  }

  // clean up if needed
  return () => disposables.forEach(d => d.dispose && d.dispose());
}

/**
 * 4) Simple ProgressBar component
 */
export function ProgressBar({ percent }) {
  return (
    <div style={{ height: 4, background: '#eee', width: '100%', marginBottom: 4 }}>
      <div
        style={{
          height: '100%',
          width: `${Math.min(Math.max(percent, 0), 100)}%`,
          background: '#007acc',
          transition: 'width 0.2s ease-out'
        }}
      />
    </div>
  );
}

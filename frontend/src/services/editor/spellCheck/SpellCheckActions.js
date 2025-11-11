// src/services/editor/SpellCheckActions.js
import * as monaco from 'monaco-editor';
import DictionaryService from '@/services/dictionary';
import SpellCheckService from './SpellCheckService';
import MonacoMarkerAdapter from '../MonacoMarkerAdapter';

/**
 * Service for managing spell check quick fix actions and commands in Monaco editor
 */
export default class SpellCheckActions {
  /**
   * Register quick fix actions for spell check markers
   * @param {Object} editor - Monaco editor instance
   * @param {Object} suggestionsMapRef - Reference to suggestions map
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @returns {Function} Cleanup function to dispose of registrations
   */
  static registerQuickFixActions(editor, suggestionsMapRef, getCategoryId = null, getFolderPath = null) {
    // Guard against Monaco not being loaded
    if (!monaco || !monaco.languages || !monaco.editor) {
      console.warn('Monaco editor not fully loaded, skipping quick fix registration');
      return () => {}; // Return empty cleanup function
    }

    const disposables = [];

    // Register code action provider
    disposables.push(this._registerCodeActionProvider(suggestionsMapRef, getCategoryId, getFolderPath));

    // Register all commands (only once globally)
    this._registerGlobalCommands(getCategoryId, getFolderPath);

    // Return cleanup function
    return () => disposables.forEach(d => d.dispose && d.dispose());
  }

  /**
   * Register the code action provider for spell check suggestions
   * @param {Object} suggestionsMapRef - Reference to suggestions map
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @returns {Object} Disposable registration
   * @private
   */
  static _registerCodeActionProvider(suggestionsMapRef, getCategoryId, getFolderPath) {
    return monaco.languages.registerCodeActionProvider('markdown', {
      provideCodeActions(model, range) {
        const actions = [];

        // Get current categoryId and folderPath dynamically
        const categoryId = typeof getCategoryId === 'function' ? getCategoryId() : getCategoryId;
        const folderPath = typeof getFolderPath === 'function' ? getFolderPath() : getFolderPath;

        // Check for spell check actions
        const wordInfo = model.getWordAtPosition(range.getStartPosition());
        if (wordInfo && wordInfo.word) {
          let suggestions = SpellCheckActions._findSuggestions(
            suggestionsMapRef,
            range,
            model,
            wordInfo
          );

          // For positions that might have multiple markers (spelling, grammar, style),
          // prioritize grammar suggestions for quick fixes
          if (suggestions && suggestions.type !== 'grammar') {
            console.log('Found non-grammar suggestion, checking for grammar alternatives...');
            const markers = monaco.editor.getModelMarkers({ resource: model.uri, owner: 'spell' });
            const grammarMarker = markers.find(m =>
              m.startLineNumber === range.startLineNumber &&
              range.startColumn >= m.startColumn &&
              range.startColumn <= m.endColumn &&
              m.message && m.message.includes('repeated')  // Look for grammar markers
            );

            if (grammarMarker) {
              const grammarKey = `${grammarMarker.startLineNumber}:${grammarMarker.startColumn}`;
              const grammarSuggestions = suggestionsMapRef.current.get(grammarKey);
              if (grammarSuggestions && grammarSuggestions.type === 'grammar') {
                console.log('Found grammar suggestion, using instead:', grammarSuggestions.type);
                suggestions = grammarSuggestions;
              }
            }
          }

          // For grammar issues, if we still didn't find suggestions using the word position,
          // try to find them using any marker that contains the current position
          if (!suggestions) {
            console.log('Initial suggestion lookup failed, trying marker fallback...');
            console.log('Cursor position:', {
              line: range.startLineNumber,
              column: range.startColumn,
              wordInfo: wordInfo
            });

            const markers = monaco.editor.getModelMarkers({ resource: model.uri, owner: 'spell' });
            console.log('All spell markers:', markers.map(m => ({
              line: m.startLineNumber,
              startCol: m.startColumn,
              endCol: m.endColumn,
              message: m.message
            })));

            const containingMarker = markers.find(m =>
              m.startLineNumber === range.startLineNumber &&
              range.startColumn >= m.startColumn &&
              range.startColumn <= m.endColumn
            );

            console.log('Found containing marker:', containingMarker);

            if (containingMarker) {
              const markerKey = `${containingMarker.startLineNumber}:${containingMarker.startColumn}`;
              suggestions = suggestionsMapRef.current.get(markerKey);
              console.log('Found suggestions using marker position:', {
                markerKey,
                suggestions: suggestions?.type,
                cursorPosition: range.startColumn
              });
            }
          } else {
            console.log('Found suggestions immediately:', suggestions?.type);
          }

          if (suggestions) {
            let trueRange;

            // For grammar issues, we need to use the actual marker range, not just the word range
            if (suggestions.type === 'grammar') {
              // Find the marker that contains this position (cursor anywhere within the marker)
              const markers = monaco.editor.getModelMarkers({ resource: model.uri, owner: 'spell' });
              const marker = markers.find(m =>
                m.startLineNumber === range.startLineNumber &&
                range.startColumn >= m.startColumn &&
                range.startColumn <= m.endColumn
              );

              if (marker) {
                trueRange = new monaco.Range(
                  marker.startLineNumber,
                  marker.startColumn,
                  marker.endLineNumber,
                  marker.endColumn
                );
                console.log('Using marker range for grammar issue:', {
                  markerStart: marker.startColumn,
                  markerEnd: marker.endColumn,
                  cursorPosition: range.startColumn,
                  trueRange
                });
              } else {
                // Fallback to word range if marker not found
                trueRange = new monaco.Range(
                  range.startLineNumber,
                  wordInfo.startColumn,
                  range.endLineNumber,
                  wordInfo.startColumn + wordInfo.word.length
                );
              }
            } else {
              // For spelling issues, use word range as before
              trueRange = new monaco.Range(
                range.startLineNumber,
                wordInfo.startColumn,
                range.endLineNumber,
                wordInfo.startColumn + wordInfo.word.length
              );
            }
            // Only add replacement suggestions for spelling issues
            // Grammar and style suggestions are descriptive, not replacement text
            if (suggestions.type === 'spelling' || (!suggestions.type && Array.isArray(suggestions))) {
              // Handle both new format (with type) and legacy format (plain array)
              const replacementActions = SpellCheckActions._createReplacementActions(
                suggestions.suggestions || suggestions,
                trueRange,
                model
              );
              actions.push(...replacementActions);

              // Add dictionary actions for spelling issues
              actions.push(...SpellCheckActions._createDictionaryActions(
                wordInfo.word,
                range,
                suggestionsMapRef,
                folderPath,
                categoryId,
                model
              ));
            } else if (suggestions.type === 'grammar') {
              // For grammar issues, try to provide intelligent fixes
              console.log('SpellCheckActions: Creating grammar actions for:', suggestions);
              console.log('Full issue object:', JSON.stringify(suggestions, null, 2));
              const grammarActions = SpellCheckActions._createGrammarActions(
                suggestions,
                trueRange,
                model
              );
              console.log('SpellCheckActions: Grammar actions created:', grammarActions);
              actions.push(...grammarActions);
            }
            // Style issues don't get quick fixes as they're usually subjective suggestions
          }
        }

        return { actions, dispose: () => {} };
      }
    });
  }

  /**
   * Find suggestions for a word at a specific range
   * @param {Object} suggestionsMapRef - Reference to suggestions map
   * @param {Object} range - Monaco range
   * @param {Object} model - Monaco model
   * @param {Object} wordInfo - Word information
   * @returns {Array|null} Array of suggestions or null
   * @private
   */
  static _findSuggestions(suggestionsMapRef, range, model, wordInfo) {
    const wordKey = `${range.startLineNumber}:${wordInfo.startColumn}`;
    let suggestions = suggestionsMapRef.current.get(wordKey);

    console.log('_findSuggestions called:', {
      wordKey,
      found: !!suggestions,
      wordInfo,
      availableKeys: Array.from(suggestionsMapRef.current.keys())
    });

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
      }
    }

    return suggestions;
  }

  /**
   * Create replacement action suggestions
   * @param {Array} suggestions - Array of word suggestions
   * @param {Object} range - Monaco range
   * @param {Object} model - Monaco model
   * @returns {Array} Array of replacement actions
   * @private
   */
  static _createReplacementActions(suggestions, range, model) {
    return suggestions.map((word, idx) => ({
      title: `${word}`,
      kind: 'quickfix',
      edit: {
        edits: [{
          resource: model.uri,
          textEdit: {
            range: range,
            text: word
          }
        }]
      },
      diagnostics: [],
      isPreferred: idx === 0,
      command: {
        id: 'spell.handleWordReplacement',
        title: 'Handle Word Replacement',
        arguments: [range, word, { getModel: () => model }]
      }
    }));
  }

  /**
   * Create grammar fix actions for specific grammar issues
   * @param {Object} suggestions - Grammar suggestions object
   * @param {Object} range - Monaco range
   * @param {Object} model - Monaco model
   * @returns {Array} Array of grammar fix actions
   * @private
   */
  static _createGrammarActions(suggestions, range, model) {
    const actions = [];

    console.log('_createGrammarActions called with:', { suggestions, range });
    console.log('Range details:', {
      startLineNumber: range.startLineNumber,
      startColumn: range.startColumn,
      endLineNumber: range.endLineNumber,
      endColumn: range.endColumn
    });

    // Handle repeated words
    if (suggestions.rule === 'repeated-words') {
      console.log('Detected repeated words issue');
      const text = model.getValueInRange(range);
      console.log('Text in range:', JSON.stringify(text));
      const words = text.toLowerCase().split(/\s+/);
      console.log('Words split:', words);

      // Check for duplicate consecutive words
      const duplicates = [];
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i] === words[i + 1] && words[i].length > 2) {
          duplicates.push(words[i]);
        }
      }

      if (duplicates.length > 0) {
        console.log('Found duplicate words:', duplicates);
        // Create action to remove the duplicate while preserving capitalization
        const duplicateWord = duplicates[0];

        // Use a more sophisticated replacement that preserves the first word's capitalization
        const regex = new RegExp(`\\b(\\w+)\\s+${duplicateWord}\\b`, 'i');
        const match = text.match(regex);

        let cleanedText;
        if (match) {
          // Replace with the first occurrence (which preserves original capitalization)
          cleanedText = text.replace(regex, match[1]);
        } else {
          // Fallback to simple replacement
          cleanedText = text.replace(new RegExp(`\\b${duplicateWord}\\s+${duplicateWord}\\b`, 'i'), duplicateWord);
        }

        actions.push({
          title: `Remove duplicate "${duplicateWord}"`,
          kind: 'quickfix',
          edit: {
            edits: [{
              resource: model.uri,
              textEdit: {
                range: range,
                text: cleanedText
              }
            }]
          }
        });
      } else {
        console.log('No duplicate words found in text');
      }
    }

    console.log('Grammar actions created:', actions);
    return actions;
  }

  /**
   * Create dictionary action suggestions
   * @param {string} word - Word to add to dictionary
   * @param {Object} range - Monaco range
   * @param {Object} suggestionsMapRef - Reference to suggestions map
   * @param {string} folderPath - Current folder path
   * @param {string} categoryId - Current category ID
   * @param {Object} model - Monaco model
   * @returns {Array} Array of dictionary actions
   * @private
   */
  static _createDictionaryActions(word, range, suggestionsMapRef, folderPath, categoryId, model) {
    const actions = [];
    const wordKey = `${range.startLineNumber}:${range.startColumn}`;

    if (folderPath) {
      // Add to folder dictionary
      actions.push({
        title: `Add to Folder Dict`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToFolderDictionary',
          title: 'Add to folder dictionary',
          arguments: [wordKey, range, { getModel: () => model }, suggestionsMapRef, folderPath]
        }
      });

      // Add to user dictionary (global)
      actions.push({
        title: `Add to User Dict`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToUserDictionary',
          title: 'Add to user dictionary',
          arguments: [wordKey, range, { getModel: () => model }, suggestionsMapRef, null]
        }
      });
    } else if (categoryId) {
      // Backward compatibility: Add to category dictionary
      actions.push({
        title: `Add to Category Dict`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToCategoryDictionary',
          title: 'Add to category dictionary',
          arguments: [wordKey, range, { getModel: () => model }, suggestionsMapRef, categoryId]
        }
      });

      // Add to user dictionary (global)
      actions.push({
        title: `Add to User Dict`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToUserDictionary',
          title: 'Add to user dictionary',
          arguments: [wordKey, range, { getModel: () => model }, suggestionsMapRef, null]
        }
      });
    } else {
      // Only user dictionary option when no folder or category
      actions.push({
        title: `Add to Dict`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToUserDictionary',
          title: 'Add to user dictionary',
          arguments: [wordKey, range, { getModel: () => model }, suggestionsMapRef, null]
        }
      });
    }

    return actions;
  }

  /**
   * Register all global Monaco commands (only once)
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static _registerGlobalCommands(getCategoryId, getFolderPath) {
    // Register word replacement handler
    if (!monaco.editor._spellHandleWordReplacementRegistered) {
      monaco.editor.registerCommand('spell.handleWordReplacement', async (accessor, ...args) => {
        const [range, newWord, editorInstance] = args;
        await SpellCheckActions._handleWordReplacement(range, newWord, editorInstance, getCategoryId, getFolderPath);
      });
      monaco.editor._spellHandleWordReplacementRegistered = true;
    }

    // Register folder dictionary command
    if (!monaco.editor._spellAddToFolderDictionaryRegistered) {
      monaco.editor.registerCommand('spell.addToFolderDictionary', async (accessor, ...args) => {
        const [key, range, editorInstance, suggestionsMapRefArg, folderPath] = args;
        await SpellCheckActions._handleAddToFolderDictionary(
          key, range, editorInstance, suggestionsMapRefArg, folderPath, getCategoryId, getFolderPath
        );
      });
      monaco.editor._spellAddToFolderDictionaryRegistered = true;
    }

    // Register category dictionary command
    if (!monaco.editor._spellAddToCategoryDictionaryRegistered) {
      monaco.editor.registerCommand('spell.addToCategoryDictionary', async (accessor, ...args) => {
        const [key, range, editorInstance, suggestionsMapRefArg, categoryId] = args;
        await SpellCheckActions._handleAddToCategoryDictionary(
          key, range, editorInstance, suggestionsMapRefArg, categoryId, getCategoryId, getFolderPath
        );
      });
      monaco.editor._spellAddToCategoryDictionaryRegistered = true;
    }

    // Register user dictionary command
    if (!monaco.editor._spellAddToUserDictionaryRegistered) {
      monaco.editor.registerCommand('spell.addToUserDictionary', async (accessor, ...args) => {
        const [key, range, editorInstance, suggestionsMapRefArg, categoryId] = args;
        await SpellCheckActions._handleAddToUserDictionary(
          key, range, editorInstance, suggestionsMapRefArg, categoryId, getCategoryId, getFolderPath
        );
      });
      monaco.editor._spellAddToUserDictionaryRegistered = true;
    }

    // Register spell check region command (legacy - kept for compatibility)
    if (!monaco.editor._spellCheckRegionRegistered) {
      monaco.editor.registerCommand('spell.checkRegion', async (accessor, ...args) => {
        const [range, editorInstance, categoryId] = args;
        await SpellCheckActions._handleSpellCheckRegion(range, editorInstance, categoryId, getCategoryId, getFolderPath);
      });
      monaco.editor._spellCheckRegionRegistered = true;
    }
  }

  /**
   * Handle word replacement - immediately remove marker and trigger spell check
   * @param {Object} range - Monaco range of the replaced word
   * @param {string} newWord - The replacement word
   * @param {Object} editorInstance - Editor instance
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static async _handleWordReplacement(range, newWord, editorInstance, getCategoryId, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function') {
      console.error('spell.handleWordReplacement: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();

    // Immediately clear markers for this specific word to remove underline
    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
      .filter(m => m.owner === 'spell' &&
                   m.startLineNumber === range.startLineNumber &&
                   m.startColumn === range.startColumn);

    if (markers.length > 0) {
      // Remove the specific marker for this word
      const remainingMarkers = monaco.editor.getModelMarkers({ resource: model.uri })
        .filter(m => !(m.owner === 'spell' &&
                       m.startLineNumber === range.startLineNumber &&
                       m.startColumn === range.startColumn));

      monaco.editor.setModelMarkers(model, 'spell', remainingMarkers.filter(m => m.owner === 'spell'));
    }

    // Trigger a focused spell check around the changed area
    // Wait a moment for the text change to be processed
    setTimeout(() => {
      SpellCheckActions._triggerLocalSpellCheck(range, editorInstance, getCategoryId, getFolderPath);
    }, 100);
  }

  /**
   * Handle adding word to folder dictionary
   * @private
   */
  static async _handleAddToFolderDictionary(key, range, editorInstance, suggestionsMapRefArg, folderPath, getCategoryId, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
      console.error('spell.addToFolderDictionary: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();
    const wordInfo = model.getWordAtPosition(range.getStartPosition());
    if (!wordInfo || !wordInfo.word) return;

    try {
      await DictionaryService.addWord(wordInfo.word, null, folderPath, null);

      // Immediately remove the marker for this word
      SpellCheckActions._removeMarkerForWord(model, range);
      suggestionsMapRefArg.current.delete(key);

      // Trigger full document rescan to ensure all instances are updated
      await SpellCheckActions._triggerFullDocumentSpellCheck(editorInstance, getCategoryId, getFolderPath);
    } catch (error) {
      console.error('Failed to add word to folder dictionary:', error);
      suggestionsMapRefArg.current.delete(key);
    }
  }

  /**
   * Handle adding word to category dictionary
   * @private
   */
  static async _handleAddToCategoryDictionary(key, range, editorInstance, suggestionsMapRefArg, categoryId, getCategoryId, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
      console.error('spell.addToCategoryDictionary: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();
    const wordInfo = model.getWordAtPosition(range.getStartPosition());
    if (!wordInfo || !wordInfo.word) return;

    try {
      await DictionaryService.addWord(wordInfo.word, null, null, categoryId);

      // Immediately remove the marker for this word
      SpellCheckActions._removeMarkerForWord(model, range);
      suggestionsMapRefArg.current.delete(key);

      // Trigger full document rescan to ensure all instances are updated
      const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : categoryId;
      await SpellCheckActions._triggerFullDocumentSpellCheck(editorInstance, currentCategoryId, getFolderPath);
    } catch (error) {
      console.error('Failed to add word to category dictionary:', error);
      suggestionsMapRefArg.current.delete(key);
    }
  }

  /**
   * Handle adding word to user dictionary
   * @private
   */
  static async _handleAddToUserDictionary(key, range, editorInstance, suggestionsMapRefArg, categoryId, getCategoryId, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
      console.error('spell.addToUserDictionary: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();
    const wordInfo = model.getWordAtPosition(range.getStartPosition());
    if (!wordInfo || !wordInfo.word) return;

    try {
      DictionaryService.addCustomWord(wordInfo.word);

      // Immediately remove the marker for this word
      SpellCheckActions._removeMarkerForWord(model, range);
      suggestionsMapRefArg.current.delete(key);

      // Trigger full document rescan to ensure all instances are updated
      const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : categoryId;
      await SpellCheckActions._triggerFullDocumentSpellCheck(editorInstance, currentCategoryId, getFolderPath);
    } catch (error) {
      console.error('Failed to add word to user dictionary:', error);
      suggestionsMapRefArg.current.delete(key);
    }
  }

  /**
   * Handle spell checking a specific region (legacy compatibility)
   * @private
   */
  static async _handleSpellCheckRegion(range, editorInstance, categoryId, getCategoryId, getFolderPath) {
    await SpellCheckActions._triggerLocalSpellCheck(range, editorInstance, getCategoryId, getFolderPath);
  }

  /**
   * Remove marker for a specific word immediately
   * @param {Object} model - Monaco editor model
   * @param {Object} range - Range of the word
   * @private
   */
  static _removeMarkerForWord(model, range) {
    const allMarkers = monaco.editor.getModelMarkers({ resource: model.uri });
    const filteredMarkers = allMarkers.filter(marker => {
      // Keep markers that are NOT the spell check marker for this specific word
      return !(marker.owner === 'spell' &&
               marker.startLineNumber === range.startLineNumber &&
               marker.startColumn === range.startColumn);
    });

    // Only update spell markers
    const spellMarkers = filteredMarkers.filter(m => m.owner === 'spell');
    monaco.editor.setModelMarkers(model, 'spell', spellMarkers);
  }

  /**
   * Trigger a local spell check around a specific range
   * @param {Object} range - Monaco range to check around
   * @param {Object} editorInstance - Editor instance
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static async _triggerLocalSpellCheck(range, editorInstance, getCategoryId, getFolderPath) {
    const model = editorInstance.getModel();

    // Check a wider area around the change (3 lines before and after)
    const startLine = Math.max(1, range.startLineNumber - 3);
    const endLine = Math.min(model.getLineCount(), range.endLineNumber + 3);

    const startOffset = model.getOffsetAt({ lineNumber: startLine, column: 1 });
    const endOffset = model.getOffsetAt({ lineNumber: endLine, column: model.getLineMaxColumn(endLine) });

    const regionText = model.getValueInRange({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: model.getLineMaxColumn(endLine)
    });

    const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : null;
    const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : null;

    try {
      const issues = await SpellCheckService.scan(regionText, () => {}, currentCategoryId, currentFolderPath);

      // Update markers for this region only
      const existingMarkers = monaco.editor.getModelMarkers({ resource: model.uri })
        .filter(m => m.owner === 'spell');

      // Remove old markers in this region
      const markersOutsideRegion = existingMarkers.filter(marker => {
        const markerOffset = model.getOffsetAt({
          lineNumber: marker.startLineNumber,
          column: marker.startColumn
        });
        return markerOffset < startOffset || markerOffset > endOffset;
      });

      // Create new markers for this region
      const newMarkers = issues.map(issue => {
        const globalOffset = startOffset + issue.offset;
        const pos = model.getPositionAt(globalOffset);
        const wordLength = issue.word ? issue.word.length : 1;

        return {
          owner: 'spell',
          severity: monaco.MarkerSeverity.Warning,
          message: `"${issue.word}" — ${issue.suggestions?.slice(0, 3).join(', ') || 'no suggestions'}`,
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column + wordLength,
        };
      });

      // Combine markers from outside region with new markers
      const allSpellMarkers = [...markersOutsideRegion, ...newMarkers];
      monaco.editor.setModelMarkers(model, 'spell', allSpellMarkers);

    } catch (error) {
      console.error('Failed to check local region:', error);
    }
  }

  /**
   * Trigger a full document spell check
   * @param {Object} editorInstance - Editor instance
   * @param {Function|string} getCategoryId - Function or value to get category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static async _triggerFullDocumentSpellCheck(editorInstance, getCategoryId, getFolderPath) {
    // Try to use the global spell check trigger from useEditor if available
    if (window.editorSpellCheckTrigger && typeof window.editorSpellCheckTrigger === 'function') {
      // Use the editor's own spell check function for better integration
      window.editorSpellCheckTrigger(null, 0);
      return;
    }

    // Fallback to direct spell check service call
    const model = editorInstance.getModel();
    const fullText = model.getValue();

    const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : null;
    const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : null;

    try {
      const issues = await SpellCheckService.scan(fullText, () => {}, currentCategoryId, currentFolderPath);
      MonacoMarkerAdapter.toMonacoMarkers({ getModel: () => model }, issues, 0);
    } catch (error) {
      console.error('Failed to rescan document after dictionary update:', error);
    }
  }

  /**
   * Rescan the entire document after dictionary changes (legacy method - kept for compatibility)
   * @param {Object} model - Monaco editor model
   * @param {string} categoryId - Category ID
   * @param {Function|string} getFolderPath - Function or value to get folder path
   * @private
   */
  static async _rescanDocument(model, categoryId, getFolderPath) {
    const fullText = model.getValue();
    const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : null;

    try {
      const issues = await SpellCheckService.scan(fullText, () => {}, categoryId, currentFolderPath);
      MonacoMarkerAdapter.toMonacoMarkers({ getModel: () => model }, issues, 0);
    } catch (error) {
      console.error('Failed to rescan document after dictionary update:', error);
    }
  }
}

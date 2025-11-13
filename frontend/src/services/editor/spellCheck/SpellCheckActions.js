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

    // Register hover provider for rich tooltips
    disposables.push(this._registerHoverProvider(suggestionsMapRef));

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

        // Get spell check markers that intersect with the current range
        const markers = monaco.editor.getModelMarkers({
          resource: model.uri,
          owner: 'spell'
        });

        // First, check if there's a marker at the exact cursor position (start of range)
        const cursorPosition = range.getStartPosition();
        const markerAtCursor = markers.find(marker =>
          marker.startLineNumber === cursorPosition.lineNumber &&
          cursorPosition.column >= marker.startColumn &&
          cursorPosition.column <= marker.endColumn
        );

        let markersToProcess = [];

        if (markerAtCursor) {
          // If cursor is on a specific marker, only show quick fixes for that marker
          markersToProcess = [markerAtCursor];
        } else {
          // If cursor is not on a specific marker, show all markers that intersect with the range
          // This maintains backward compatibility for broader selections
          markersToProcess = markers.filter(marker => {
            return marker.startLineNumber <= range.endLineNumber &&
                   marker.endLineNumber >= range.startLineNumber &&
                   marker.startColumn <= range.endColumn &&
                   marker.endColumn >= range.startColumn;
          });
        }

        for (const marker of markersToProcess) {
          // Get suggestions for this specific marker
          const markerKey = `${marker.startLineNumber}:${marker.startColumn}`;
          const suggestions = suggestionsMapRef.current.get(markerKey);

          if (suggestions) {
            // Use the marker range for actions
            const markerRange = new monaco.Range(
              marker.startLineNumber,
              marker.startColumn,
              marker.endLineNumber,
              marker.endColumn
            );

            // Only add replacement suggestions for spelling issues
            // Grammar and style suggestions are descriptive, not replacement text
            if (suggestions.type === 'spelling' || (!suggestions.type && Array.isArray(suggestions))) {
              // Handle both new format (with type) and legacy format (plain array)
              const replacementActions = SpellCheckActions._createReplacementActions(
                suggestions.suggestions || suggestions,
                markerRange,
                model
              );
              actions.push(...replacementActions);

              // Add dictionary actions for spelling issues
              actions.push(...SpellCheckActions._createDictionaryActions(
                model.getValueInRange(markerRange), // Get the actual word from the marker range
                markerRange,
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
                markerRange,
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
   * Register hover provider for spell check markers
   * @param {Object} suggestionsMapRef - Reference to suggestions map
   * @returns {Object} Disposable registration
   * @private
   */
  static _registerHoverProvider(suggestionsMapRef) {
    return monaco.languages.registerHoverProvider('markdown', {
      provideHover(model, position) {
        // Find spell check markers at this position
        const markers = monaco.editor.getModelMarkers({ resource: model.uri, owner: 'spell' });
        const markerAtPosition = markers.find(marker => {
          // Check if position is within marker range
          if (position.lineNumber < marker.startLineNumber || position.lineNumber > marker.endLineNumber) {
            return false;
          }
          if (position.lineNumber === marker.startLineNumber && position.column < marker.startColumn) {
            return false;
          }
          if (position.lineNumber === marker.endLineNumber && position.column > marker.endColumn) {
            return false;
          }
          return true;
        });

        if (!markerAtPosition) {
          return null;
        }

        // Get suggestions for this marker
        const markerKey = `${markerAtPosition.startLineNumber}:${markerAtPosition.startColumn}`;
        const suggestions = suggestionsMapRef.current.get(markerKey);

        if (!suggestions) {
          return null;
        }

        // Create rich hover content based on issue type
        const contents = [];

        switch (suggestions.type) {
          case 'spelling': {
            const word = model.getWordAtPosition(position)?.word || '';
            const suggestionList = suggestions.suggestions?.slice(0, 5) || [];

            contents.push({
              value: `**Spelling Error**: \`${word}\``,
              isTrusted: true
            });

            if (suggestionList.length > 0) {
              contents.push({
                value: `**Suggestions**: ${suggestionList.join(', ')}`,
                isTrusted: true
              });
            }

            contents.push({
              value: `*Click Ctrl+. for quick fixes*`,
              isTrusted: true
            });
            break;
          }

          case 'grammar': {
            contents.push({
              value: `**Grammar Issue**`,
              isTrusted: true
            });

            if (suggestions.message) {
              // Handle long grammar messages by splitting into multiple lines
              const maxLineLength = 80; // Monaco hover width limit
              if (suggestions.message.length > maxLineLength) {
                // Split message into chunks at word boundaries
                const words = suggestions.message.split(' ');
                let currentLine = '';
                const lines = [];

                for (const word of words) {
                  if ((currentLine + ' ' + word).length <= maxLineLength) {
                    currentLine += (currentLine ? ' ' : '') + word;
                  } else {
                    if (currentLine) {
                      lines.push(currentLine);
                    }
                    currentLine = word;
                  }
                }
                if (currentLine) {
                  lines.push(currentLine);
                }

                // Add each line as separate content item
                lines.forEach(line => {
                  contents.push({
                    value: line,
                    isTrusted: true
                  });
                });
              } else {
                contents.push({
                  value: suggestions.message,
                  isTrusted: true
                });
              }
            }

            contents.push({
              value: `*Click Ctrl+. for quick fixes*`,
              isTrusted: true
            });
            break;
          }

          case 'style': {
            contents.push({
              value: `**Style Suggestion**`,
              isTrusted: true
            });

            if (suggestions.message) {
              contents.push({
                value: suggestions.message,
                isTrusted: true
              });
            }
            break;
          }

          default: {
            // Legacy format
            const word = model.getWordAtPosition(position)?.word || '';
            const suggestionList = Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];

            contents.push({
              value: `**Issue**: \`${word}\``,
              isTrusted: true
            });

            if (suggestionList.length > 0) {
              contents.push({
                value: `**Suggestions**: ${suggestionList.join(', ')}`,
                isTrusted: true
              });
            }
          }
        }

        return {
          range: new monaco.Range(
            markerAtPosition.startLineNumber,
            markerAtPosition.startColumn,
            markerAtPosition.endLineNumber,
            markerAtPosition.endColumn
          ),
          contents
        };
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

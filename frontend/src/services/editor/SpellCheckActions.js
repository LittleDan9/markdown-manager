// src/services/editor/SpellCheckActions.js
import * as monaco from 'monaco-editor';
import DictionaryService from '@/services/dictionary';
import SpellCheckService from './SpellCheckService';
import MonacoMarkerAdapter from './MonacoMarkerAdapter';

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
        // Get current categoryId and folderPath dynamically
        const categoryId = typeof getCategoryId === 'function' ? getCategoryId() : getCategoryId;
        const folderPath = typeof getFolderPath === 'function' ? getFolderPath() : getFolderPath;

        const wordInfo = model.getWordAtPosition(range.getStartPosition());
        if (!wordInfo || !wordInfo.word) return { actions: [], dispose: () => {} };

        const trueRange = new monaco.Range(
          range.startLineNumber,
          wordInfo.startColumn,
          range.endLineNumber,
          wordInfo.startColumn + wordInfo.word.length
        );

        const suggestions = SpellCheckActions._findSuggestions(
          suggestionsMapRef, 
          range, 
          model, 
          wordInfo
        );

        if (!suggestions) return { actions: [], dispose: () => {} };

        const actions = [];

        // Add replacement suggestions
        actions.push(...SpellCheckActions._createReplacementActions(suggestions, trueRange, model));

        // Add dictionary actions
        actions.push(...SpellCheckActions._createDictionaryActions(
          wordInfo.word, 
          range, 
          suggestionsMapRef, 
          folderPath, 
          categoryId
        ));

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
        id: 'spell.checkRegion',
        title: 'Spell Check Region',
        arguments: [range, { getModel: () => model }]
      }
    }));
  }

  /**
   * Create dictionary action suggestions
   * @param {string} word - Word to add to dictionary
   * @param {Object} range - Monaco range
   * @param {Object} suggestionsMapRef - Reference to suggestions map
   * @param {string} folderPath - Current folder path
   * @param {string} categoryId - Current category ID
   * @returns {Array} Array of dictionary actions
   * @private
   */
  static _createDictionaryActions(word, range, suggestionsMapRef, folderPath, categoryId) {
    const actions = [];
    const wordKey = `${range.startLineNumber}:${range.startColumn}`;

    if (folderPath) {
      // Add to folder dictionary
      actions.push({
        title: `Add "${word}" to Folder Dictionary`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToFolderDictionary',
          title: 'Add to folder dictionary',
          arguments: [wordKey, range, { getModel: () => range.getModel() }, suggestionsMapRef, folderPath]
        }
      });

      // Add to user dictionary (global)
      actions.push({
        title: `Add "${word}" to User Dictionary`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToUserDictionary',
          title: 'Add to user dictionary',
          arguments: [wordKey, range, { getModel: () => range.getModel() }, suggestionsMapRef, null]
        }
      });
    } else if (categoryId) {
      // Backward compatibility: Add to category dictionary
      actions.push({
        title: `Add "${word}" to Category Dictionary`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToCategoryDictionary',
          title: 'Add to category dictionary',
          arguments: [wordKey, range, { getModel: () => range.getModel() }, suggestionsMapRef, categoryId]
        }
      });

      // Add to user dictionary (global)
      actions.push({
        title: `Add "${word}" to User Dictionary`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToUserDictionary',
          title: 'Add to user dictionary',
          arguments: [wordKey, range, { getModel: () => range.getModel() }, suggestionsMapRef, null]
        }
      });
    } else {
      // Only user dictionary option when no folder or category
      actions.push({
        title: `Add "${word}" to User Dictionary`,
        kind: 'quickfix',
        command: {
          id: 'spell.addToUserDictionary',
          title: 'Add to user dictionary',
          arguments: [wordKey, range, { getModel: () => range.getModel() }, suggestionsMapRef, null]
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
    // Register folder dictionary command
    if (!monaco.editor._spellAddToFolderDictionaryRegistered) {
      monaco.editor.registerCommand('spell.addToFolderDictionary', async (accessor, ...args) => {
        const [key, range, editorInstance, suggestionsMapRefArg, folderPath] = args;
        await SpellCheckActions._handleAddToFolderDictionary(
          key, range, editorInstance, suggestionsMapRefArg, folderPath, getFolderPath
        );
      });
      monaco.editor._spellAddToFolderDictionaryRegistered = true;
    }

    // Register category dictionary command
    if (!monaco.editor._spellAddToCategoryDictionaryRegistered) {
      monaco.editor.registerCommand('spell.addToCategoryDictionary', async (accessor, ...args) => {
        const [key, range, editorInstance, suggestionsMapRefArg, categoryId] = args;
        await SpellCheckActions._handleAddToCategoryDictionary(
          key, range, editorInstance, suggestionsMapRefArg, categoryId, getFolderPath
        );
      });
      monaco.editor._spellAddToCategoryDictionaryRegistered = true;
    }

    // Register user dictionary command
    if (!monaco.editor._spellAddToUserDictionaryRegistered) {
      monaco.editor.registerCommand('spell.addToUserDictionary', (accessor, ...args) => {
        const [key, range, editorInstance, suggestionsMapRefArg, categoryId] = args;
        SpellCheckActions._handleAddToUserDictionary(
          key, range, editorInstance, suggestionsMapRefArg, categoryId, getFolderPath
        );
      });
      monaco.editor._spellAddToUserDictionaryRegistered = true;
    }

    // Register spell check region command
    if (!monaco.editor._spellCheckRegionRegistered) {
      monaco.editor.registerCommand('spell.checkRegion', (accessor, ...args) => {
        const [range, editorInstance, categoryId] = args;
        SpellCheckActions._handleSpellCheckRegion(range, editorInstance, categoryId, getFolderPath);
      });
      monaco.editor._spellCheckRegionRegistered = true;
    }
  }

  /**
   * Handle adding word to folder dictionary
   * @private
   */
  static async _handleAddToFolderDictionary(key, range, editorInstance, suggestionsMapRefArg, folderPath, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
      console.error('spell.addToFolderDictionary: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();
    const wordInfo = model.getWordAtPosition(range.getStartPosition());
    if (!wordInfo || !wordInfo.word) return;

    try {
      await DictionaryService.addWord(wordInfo.word, null, folderPath, null);
      suggestionsMapRefArg.current.delete(key);
      await SpellCheckActions._rescanDocument(model, null, getFolderPath);
    } catch (error) {
      console.error('Failed to add word to folder dictionary:', error);
      suggestionsMapRefArg.current.delete(key);
    }
  }

  /**
   * Handle adding word to category dictionary
   * @private
   */
  static async _handleAddToCategoryDictionary(key, range, editorInstance, suggestionsMapRefArg, categoryId, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
      console.error('spell.addToCategoryDictionary: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();
    const wordInfo = model.getWordAtPosition(range.getStartPosition());
    if (!wordInfo || !wordInfo.word) return;

    try {
      await DictionaryService.addWord(wordInfo.word, null, null, categoryId);
      suggestionsMapRefArg.current.delete(key);
      await SpellCheckActions._rescanDocument(model, categoryId, getFolderPath);
    } catch (error) {
      console.error('Failed to add word to category dictionary:', error);
      suggestionsMapRefArg.current.delete(key);
    }
  }

  /**
   * Handle adding word to user dictionary
   * @private
   */
  static _handleAddToUserDictionary(key, range, editorInstance, suggestionsMapRefArg, categoryId, getFolderPath) {
    if (!editorInstance || typeof editorInstance.getModel !== 'function' || !suggestionsMapRefArg) {
      console.error('spell.addToUserDictionary: Invalid editor instance passed:', editorInstance);
      return;
    }

    const model = editorInstance.getModel();
    const wordInfo = model.getWordAtPosition(range.getStartPosition());
    if (!wordInfo || !wordInfo.word) return;

    DictionaryService.addCustomWord(wordInfo.word);
    suggestionsMapRefArg.current.delete(key);
    SpellCheckActions._rescanDocument(model, categoryId, getFolderPath);
  }

  /**
   * Handle spell checking a specific region
   * @private
   */
  static _handleSpellCheckRegion(range, editorInstance, categoryId, getFolderPath) {
    const model = editorInstance.getModel();
    const lineNumber = range.startLineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const startOffset = model.getOffsetAt({ lineNumber, column: 0 });
    
    const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : null;
    SpellCheckService.scan(lineContent, () => {}, categoryId, currentFolderPath).then(issues => {
      MonacoMarkerAdapter.toMonacoMarkers({ getModel: () => model }, issues, startOffset);
    });
  }

  /**
   * Rescan the entire document after dictionary changes
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

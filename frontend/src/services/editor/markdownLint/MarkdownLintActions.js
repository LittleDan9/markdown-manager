/**
 * MarkdownLintActions - Quick fixes and commands for markdown linting
 *
 * Provides Monaco editor actions for fixing common markdown issues
 * and integrating linting controls into the editor UI.
 */

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export class MarkdownLintActions {
  constructor() {
    this.registeredActions = new Set();
  }

  /**
   * Register quick fix actions for markdown linting
   * @param {Object} editor - Monaco editor instance
   * @param {Object} markersMapRef - Reference to markers map
   * @param {Function} getCategoryId - Function to get current category ID
   * @param {Function} getFolderPath - Function to get current folder path
   * @returns {Array} Array of registered action IDs
   */
  static registerQuickFixActions(editor, markersMapRef, _getCategoryId = null, _getFolderPath = null) {
    if (!editor) {
      return [];
    }

    // Check for Monaco availability through multiple paths (same pattern as useEditorKeyboardShortcuts)
    const monacoRef = monaco || editor.constructor?.monaco || window.monaco;
    if (!monacoRef) {
      console.warn('MarkdownLintActions: Monaco reference not available');
      return [];
    }

    const actionIds = [];
    const disposables = [];

    try {
      // Register code action provider for context-sensitive quick fixes
      const codeActionProvider = this._registerCodeActionProvider(markersMapRef, monacoRef);
      disposables.push(codeActionProvider);

      // Register hover provider for markdown lint markers
      const hoverProvider = this._registerHoverProvider(markersMapRef, monacoRef);
      disposables.push(hoverProvider);

      // Register global command for applying markdown lint fixes
      if (!monacoRef.editor._markdownLintApplyFixRegistered) {
        monacoRef.editor.registerCommand('markdownlint.applyFix', async (accessor, ...args) => {
          const [fixInfo, range, editorInstance] = args;
          await this._applyMarkdownLintFix(fixInfo, range, editorInstance);
        });
        monacoRef.editor._markdownLintApplyFixRegistered = true;
      }

      // Register fix trailing spaces action
      const fixTrailingSpacesId = 'markdownlint.fix.trailing-spaces';
      editor.addAction({
        id: fixTrailingSpacesId,
        label: 'Fix: Remove Trailing Spaces',
        keybindings: [], // Removed chord shortcut that was interfering with typing
        contextMenuGroupId: 'markdownlint',
        contextMenuOrder: 1,
        precondition: null,
        run: (editor) => this.fixTrailingSpaces(editor, markersMapRef)
      });
      actionIds.push(fixTrailingSpacesId);

      // Register fix multiple blank lines action
      const fixBlankLinesId = 'markdownlint.fix.blank-lines';
      editor.addAction({
        id: fixBlankLinesId,
        label: 'Fix: Remove Multiple Blank Lines',
        keybindings: [], // Removed chord shortcut that was interfering with typing
        contextMenuGroupId: 'markdownlint',
        contextMenuOrder: 2,
        precondition: null,
        run: (editor) => this.fixMultipleBlankLines(editor, markersMapRef)
      });
      actionIds.push(fixBlankLinesId);

      // Register fix heading spacing action
      const fixHeadingSpacingId = 'markdownlint.fix.heading-spacing';
      editor.addAction({
        id: fixHeadingSpacingId,
        label: 'Fix: Add Space After Heading Hash',
        keybindings: [], // Removed chord shortcut that was interfering with typing
        contextMenuGroupId: 'markdownlint',
        contextMenuOrder: 3,
        precondition: null,
        run: (editor) => this.fixHeadingSpacing(editor, markersMapRef)
      });
      actionIds.push(fixHeadingSpacingId);

      // Register show rule documentation action
      const showRuleDocsId = 'markdownlint.show-rule-docs';
      editor.addAction({
        id: showRuleDocsId,
        label: 'Markdown Lint: Show Rule Documentation',
        keybindings: [], // Removed chord shortcut that was interfering with typing
        contextMenuGroupId: 'markdownlint',
        contextMenuOrder: 4,
        precondition: null,
        run: (editor) => this.showRuleDocumentation(editor, markersMapRef)
      });
      actionIds.push(showRuleDocsId);

      // Register toggle linting action
      const toggleLintingId = 'markdownlint.toggle';
      editor.addAction({
        id: toggleLintingId,
        label: 'Markdown Lint: Toggle Linting',
        keybindings: [monacoRef.KeyMod.CtrlCmd | monacoRef.KeyMod.Shift | monacoRef.KeyCode.KeyL],
        contextMenuGroupId: 'markdownlint',
        contextMenuOrder: 5,
        precondition: null,
        run: (editor) => this.toggleLinting(editor)
      });
      actionIds.push(toggleLintingId);

      console.log(`MarkdownLintActions: Registered ${actionIds.length} actions and code action provider`);
      return actionIds;

    } catch (error) {
      console.error('MarkdownLintActions: Failed to register actions:', error);
      return actionIds;
    }
  }

  /**
   * Fix trailing spaces in the editor
   * @param {Object} editor - Monaco editor instance
   * @param {Object} markersMapRef - Reference to markers map
   */
  static fixTrailingSpaces(editor, _markersMapRef) {
    if (!editor) return;

    try {
      const model = editor.getModel();
      if (!model) return;

      const edits = [];
      const lineCount = model.getLineCount();

      // Find and fix trailing spaces on each line
      for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        const trimmedContent = lineContent.trimEnd();

        if (lineContent.length !== trimmedContent.length) {
          edits.push({
            range: {
              startLineNumber: lineNumber,
              startColumn: trimmedContent.length + 1,
              endLineNumber: lineNumber,
              endColumn: lineContent.length + 1
            },
            text: ''
          });
        }
      }

      if (edits.length > 0) {
        editor.executeEdits('markdownlint-fix-trailing-spaces', edits);
        console.log(`MarkdownLintActions: Fixed trailing spaces on ${edits.length} lines`);
      }

    } catch (error) {
      console.error('MarkdownLintActions: Failed to fix trailing spaces:', error);
    }
  }

  /**
   * Fix multiple consecutive blank lines
   * @param {Object} editor - Monaco editor instance
   * @param {Object} markersMapRef - Reference to markers map
   */
  static fixMultipleBlankLines(editor, _markersMapRef) {
    if (!editor) return;

    try {
      const model = editor.getModel();
      if (!model) return;

      const edits = [];
      const lineCount = model.getLineCount();
      let consecutiveBlankLines = 0;
      let blankLineStart = null;

      for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        const isBlankLine = lineContent.trim() === '';

        if (isBlankLine) {
          if (consecutiveBlankLines === 0) {
            blankLineStart = lineNumber;
          }
          consecutiveBlankLines++;
        } else {
          // Process accumulated blank lines
          if (consecutiveBlankLines > 1) {
            // Keep only one blank line
            edits.push({
              range: {
                startLineNumber: blankLineStart + 1,
                startColumn: 1,
                endLineNumber: blankLineStart + consecutiveBlankLines,
                endColumn: 1
              },
              text: ''
            });
          }
          consecutiveBlankLines = 0;
          blankLineStart = null;
        }
      }

      // Handle trailing blank lines
      if (consecutiveBlankLines > 1) {
        edits.push({
          range: {
            startLineNumber: blankLineStart + 1,
            startColumn: 1,
            endLineNumber: lineCount + 1,
            endColumn: 1
          },
          text: ''
        });
      }

      if (edits.length > 0) {
        editor.executeEdits('markdownlint-fix-blank-lines', edits);
        console.log(`MarkdownLintActions: Fixed ${edits.length} multiple blank line issues`);
      }

    } catch (error) {
      console.error('MarkdownLintActions: Failed to fix multiple blank lines:', error);
    }
  }

  /**
   * Fix heading spacing (add space after hash)
   * @param {Object} editor - Monaco editor instance
   * @param {Object} markersMapRef - Reference to markers map
   */
  static fixHeadingSpacing(editor, _markersMapRef) {
    if (!editor) return;

    try {
      const model = editor.getModel();
      if (!model) return;

      const edits = [];
      const lineCount = model.getLineCount();

      // Find heading lines that need space after hash
      for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineContent = model.getLineContent(lineNumber);
        const trimmedContent = lineContent.trim();

        // Check for ATX style headings without space
        const headingMatch = trimmedContent.match(/^(#{1,6})([^#\s])/);
        if (headingMatch) {
          const hashes = headingMatch[1];
          const _restOfLine = headingMatch[2];

          // Find position in original line
          const hashIndex = lineContent.indexOf(hashes);
          if (hashIndex !== -1) {
            edits.push({
              range: {
                startLineNumber: lineNumber,
                startColumn: hashIndex + hashes.length + 1,
                endLineNumber: lineNumber,
                endColumn: hashIndex + hashes.length + 1
              },
              text: ' '
            });
          }
        }
      }

      if (edits.length > 0) {
        editor.executeEdits('markdownlint-fix-heading-spacing', edits);
        console.log(`MarkdownLintActions: Fixed heading spacing on ${edits.length} lines`);
      }

    } catch (error) {
      console.error('MarkdownLintActions: Failed to fix heading spacing:', error);
    }
  }

  /**
   * Show rule documentation for marker at cursor
   * @param {Object} editor - Monaco editor instance
   * @param {Object} markersMapRef - Reference to markers map
   */
  static showRuleDocumentation(editor, markersMapRef) {
    if (!editor || !markersMapRef?.current) return;

    try {
      const position = editor.getPosition();
      if (!position) return;

      // Find marker at cursor position
      let targetMarker = null;
      for (const marker of markersMapRef.current.values()) {
        if (marker.startLineNumber === position.lineNumber &&
            position.column >= marker.startColumn &&
            position.column <= marker.endColumn) {
          targetMarker = marker;
          break;
        }
      }

      if (targetMarker && targetMarker.code?.target) {
        // Open rule documentation in new tab
        window.open(targetMarker.code.target, '_blank');
        console.log(`MarkdownLintActions: Opened documentation for rule ${targetMarker.code.value}`);
      } else {
        console.log('MarkdownLintActions: No rule documentation available at cursor position');
      }

    } catch (error) {
      console.error('MarkdownLintActions: Failed to show rule documentation:', error);
    }
  }

  /**
   * Toggle markdown linting on/off
   * @param {Object} editor - Monaco editor instance
   */
  static toggleLinting(editor) {
    try {
      // Dispatch custom event to toggle linting
      window.dispatchEvent(new CustomEvent('markdownlint:toggle', {
        detail: { editor }
      }));

      console.log('MarkdownLintActions: Toggled linting');

    } catch (error) {
      console.error('MarkdownLintActions: Failed to toggle linting:', error);
    }
  }

  /**
   * Fix all auto-fixable issues in the document
   * @param {Object} editor - Monaco editor instance
   * @param {Object} markersMapRef - Reference to markers map
   */
  static fixAllAutoFixable(editor, markersMapRef) {
    if (!editor) return;

    try {
      // Apply all available fixes in sequence
      this.fixTrailingSpaces(editor, markersMapRef);
      this.fixMultipleBlankLines(editor, markersMapRef);
      this.fixHeadingSpacing(editor, markersMapRef);

      console.log('MarkdownLintActions: Applied all auto-fixable corrections');

    } catch (error) {
      console.error('MarkdownLintActions: Failed to fix all issues:', error);
    }
  }

  /**
   * Register code action provider for context-sensitive quick fixes
   * @param {Object} markersMapRef - Reference to markers map
   * @param {Object} monaco - Monaco editor namespace
   * @returns {Object} Disposable registration
   * @private
   */
  static _registerCodeActionProvider(markersMapRef, monacoRef) {
    return monacoRef.languages.registerCodeActionProvider('markdown', {
      provideCodeActions(model, range, _context) {
        const actions = [];

        // Get markers at the current position
        const markers = monacoRef.editor.getModelMarkers({
          resource: model.uri,
          owner: 'markdownlint'
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
          // Check if this marker has fix information
          const markerKey = `${marker.startLineNumber}-${marker.startColumn}-${marker.endLineNumber}-${marker.endColumn}`;
          const markersMap = markersMapRef.current;

          if (markersMap && markersMap.has(markerKey)) {
            const issueData = markersMap.get(markerKey);

            // Only show quick fix if the issue is fixable
            if (issueData.fixable && issueData.fixInfo) {
              const rule = marker.code?.value || marker.code || 'unknown';

              actions.push({
                title: `🔧 Fix ${rule}: ${MarkdownLintActions._getFixDescription(rule, issueData.fixInfo)}`,
                kind: 'quickfix', // Use string instead of CodeActionKind enum which may be undefined
                isPreferred: true,
                command: {
                  id: 'markdownlint.applyFix',
                  title: 'Apply markdown lint fix',
                  arguments: [issueData.fixInfo, marker, model]
                }
              });
            }
          }
        }

        return {
          actions,
          dispose: () => {}
        };
      }
    });
  }

  /**
   * Register hover provider for markdown lint markers
   * @param {Object} markersMapRef - Reference to markers map
   * @param {Object} monaco - Monaco editor namespace
   * @returns {Object} Disposable registration
   * @private
   */
  static _registerHoverProvider(markersMapRef, monacoRef) {
    return monacoRef.languages.registerHoverProvider('markdown', {
      provideHover(model, position) {
        // Find markdownlint markers at this position
        const markers = monacoRef.editor.getModelMarkers({
          resource: model.uri,
          owner: 'markdownlint'
        });

        const markerAtPosition = markers.find(marker =>
          marker.startLineNumber === position.lineNumber &&
          position.column >= marker.startColumn &&
          position.column <= marker.endColumn
        );

        if (!markerAtPosition) {
          return null;
        }

        // Get issue data for this marker
        const markerKey = `${markerAtPosition.startLineNumber}-${markerAtPosition.startColumn}-${markerAtPosition.endLineNumber}-${markerAtPosition.endColumn}`;
        const markersMap = markersMapRef.current;
        const issueData = markersMap?.get(markerKey);

        if (!issueData) {
          return null;
        }

        // Create rich hover content
        const contents = [];
        const rule = markerAtPosition.code?.value || 'unknown';
        const ruleName = issueData.issue?.ruleName || issueData.issue?.ruleDescription || rule;

        contents.push({
          value: `**${rule}**${ruleName !== rule ? ` (${ruleName})` : ''}`,
          isTrusted: true
        });

        if (issueData.issue?.message || issueData.issue?.description) {
          contents.push({
            value: issueData.issue.message || issueData.issue.description,
            isTrusted: true
          });
        }

        // Add fixable indicator
        if (issueData.fixable) {
          contents.push({
            value: `🔧 **Auto-fixable** - Click Ctrl+. for quick fix`,
            isTrusted: true
          });
        }

        // Add rule documentation link if available
        if (markerAtPosition.code?.target) {
          contents.push({
            value: `[View Rule Documentation](${markerAtPosition.code.target})`,
            isTrusted: true
          });
        }

        return {
          range: new monacoRef.Range(
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
   * Get available quick fixes for a specific marker
   * @param {Object} marker - Marker object
   * @returns {Array} Array of available quick fix actions
   */
  static getQuickFixesForMarker(marker) {
    if (!marker || !marker.issue) {
      return [];
    }

    const quickFixes = [];
    const rule = marker.issue.rule;

    switch (rule) {
      case 'MD009': // Trailing spaces
        quickFixes.push({
          title: 'Remove trailing spaces',
          kind: 'quickfix',
          action: 'fix-trailing-spaces'
        });
        break;

      case 'MD012': // Multiple consecutive blank lines
        quickFixes.push({
          title: 'Remove extra blank lines',
          kind: 'quickfix',
          action: 'fix-blank-lines'
        });
        break;

      case 'MD018': // No space after hash on atx style heading
      case 'MD019': // Multiple spaces after hash on atx style heading
        quickFixes.push({
          title: 'Fix heading spacing',
          kind: 'quickfix',
          action: 'fix-heading-spacing'
        });
        break;

      case 'MD010': // Hard tabs
        quickFixes.push({
          title: 'Convert tabs to spaces',
          kind: 'quickfix',
          action: 'fix-hard-tabs'
        });
        break;
    }

    // Always add "Show rule documentation" option
    quickFixes.push({
      title: 'Show rule documentation',
      kind: 'info',
      action: 'show-rule-docs'
    });

    return quickFixes;
  }
}

export default MarkdownLintActions;
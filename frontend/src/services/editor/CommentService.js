/**
 * Service for handling code commenting in Markdown code blocks
 */

import { logger } from '@/providers/LoggerProvider.jsx';
import { HighlightService } from './index';
import NotificationService from '../utilities/notifications.js';

// Language comment patterns
const COMMENT_PATTERNS = {
  javascript: '// ',
  typescript: '// ',
  js: '// ',
  ts: '// ',
  jsx: '// ',
  tsx: '// ',
  python: '# ',
  py: '# ',
  bash: '# ',
  shell: '# ',
  sh: '# ',
  zsh: '# ',
  sql: '-- ',
  css: '/* {} */',
  scss: '// ',
  sass: '// ',
  less: '// ',
  html: '<!-- {} -->',
  xml: '<!-- {} -->',
  yaml: '# ',
  yml: '# ',
  json: null, // JSON doesn't support comments
  php: '// ',
  java: '// ',
  c: '// ',
  cpp: '// ',
  'c++': '// ',
  csharp: '// ',
  'c#': '// ',
  go: '// ',
  rust: '// ',
  ruby: '# ',
  rb: '# ',
  perl: '# ',
  pl: '# ',
  r: '# ',
  matlab: '% ',
  lua: '-- ',
  swift: '// ',
  kotlin: '// ',
  kt: '// ',
  scala: '// ',
  dockerfile: '# ',
  docker: '# ',
  makefile: '# ',
  vim: '" ',
  vimscript: '" ',
  powershell: '# ',
  ps1: '# ',
  haskell: '-- ',
  hs: '-- ',
  clojure: '; ',
  clj: '; ',
  elixir: '# ',
  ex: '# ',
  erlang: '% ',
  erl: '% ',
  fsharp: '// ',
  'f#': '// ',
  ocaml: '(* {} *)',
  pascal: '// ',
  delphi: '// ',
  fortran: '! ',
  cobol: '*> ',
  assembly: '; ',
  asm: '; ',
  ini: '; ',
  toml: '# ',
  conf: '# ',
  config: '# ',
  properties: '# ',
  mermaid: '%% '
};

class CommentService {
  /**
   * Get the comment pattern for a given language
   * @param {string} language - The programming language
   * @returns {string|null} - The comment pattern or null if not supported
   */
  getCommentPattern(language) {
    if (!language) return null;
    const lang = language.toLowerCase().trim();
    return COMMENT_PATTERNS[lang] || null;
  }

  /**
   * Check if the cursor is inside a code block and return the language
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
   * @param {monaco.Position} position - Current cursor position
   * @returns {Object} - {inCodeBlock: boolean, language: string|null, blockStart: number|null, blockEnd: number|null}
   */
  isInCodeBlock(editor, position) {
    const model = editor.getModel();
    let inCodeBlock = false;
    let language = null;
    let blockStart = null;
    let blockEnd = null;

    // Scan from start to current position to find if we're in a code block
    for (let i = 1; i <= model.getLineCount(); i++) {
      const lineContent = model.getLineContent(i);
      const codeBlockMatch = lineContent.match(/^```(\w+)?/);

      if (codeBlockMatch) {
        if (inCodeBlock) {
          // Closing code block
          if (i > position.lineNumber) {
            // We found the end of the current block
            blockEnd = i;
            break;
          }
          inCodeBlock = false;
          language = null;
          blockStart = null;
        } else {
          // Opening code block
          if (i < position.lineNumber) {
            // This could be the start of our current block
            inCodeBlock = true;
            language = codeBlockMatch[1] || null;
            blockStart = i;
          }
        }
      }
    }

    // If we're still in a code block but haven't found the end,
    // it means the block extends to the end of the document
    if (inCodeBlock && !blockEnd) {
      blockEnd = model.getLineCount();
    }

    return {
      inCodeBlock: inCodeBlock && position.lineNumber > blockStart,
      language,
      blockStart,
      blockEnd
    };
  }

  /**
   * Toggle comment for a single line
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
   * @param {number} lineNumber - Line number to toggle comment
   * @param {string} commentPattern - Comment pattern for the language
   * @returns {Object} - Monaco edit operation
   */
  toggleLineComment(editor, lineNumber, commentPattern) {
    const model = editor.getModel();
    const lineContent = model.getLineContent(lineNumber);

    if (commentPattern.includes('{}')) {
      // Block comment style (CSS, HTML, XML, etc.)
      return this.toggleBlockComment(editor, lineNumber, commentPattern);
    }

    // Line comment style
    const trimmed = lineContent.trimStart();
    const leadingWhitespace = lineContent.match(/^\s*/)[0];

    if (trimmed.startsWith(commentPattern)) {
      // Uncomment: remove the comment pattern
      const uncommented = leadingWhitespace + trimmed.slice(commentPattern.length);
      return {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineContent.length + 1
        },
        text: uncommented
      };
    } else {
      // Comment: add the comment pattern
      const commented = leadingWhitespace + commentPattern + trimmed;
      return {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineContent.length + 1
        },
        text: commented
      };
    }
  }

  /**
   * Toggle block comment for a single line (for languages like CSS, HTML)
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
   * @param {number} lineNumber - Line number to toggle comment
   * @param {string} commentPattern - Block comment pattern with {} placeholder
   * @returns {Object} - Monaco edit operation
   */
  toggleBlockComment(editor, lineNumber, commentPattern) {
    const model = editor.getModel();
    const lineContent = model.getLineContent(lineNumber);
    const [start, end] = commentPattern.split('{}').map(s => s.trim());

    const trimmed = lineContent.trim();
    const leadingWhitespace = lineContent.match(/^\s*/)[0];

    if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
      // Uncomment: remove block comment markers
      const inner = trimmed.slice(start.length, -end.length).trim();
      return {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineContent.length + 1
        },
        text: leadingWhitespace + inner
      };
    } else {
      // Comment: add block comment markers
      const commented = leadingWhitespace + start + ' ' + trimmed + ' ' + end;
      return {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineContent.length + 1
        },
        text: commented
      };
    }
  }

  /**
   * Toggle comments for multiple lines
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
   * @param {number} startLine - Start line number
   * @param {number} endLine - End line number
   * @param {string} commentPattern - Comment pattern for the language
   * @returns {Array} - Array of Monaco edit operations
   */
  toggleMultiLineComment(editor, startLine, endLine, commentPattern) {
    const edits = [];

    // First, check if all non-empty lines are commented
    let allCommented = true;
    const model = editor.getModel();

    for (let line = startLine; line <= endLine; line++) {
      const lineContent = model.getLineContent(line);
      const trimmed = lineContent.trim();

      // Skip empty lines
      if (trimmed === '') continue;

      if (commentPattern.includes('{}')) {
        const [start, end] = commentPattern.split('{}').map(s => s.trim());
        if (!(trimmed.startsWith(start) && trimmed.endsWith(end))) {
          allCommented = false;
          break;
        }
      } else {
        if (!trimmed.startsWith(commentPattern)) {
          allCommented = false;
          break;
        }
      }
    }

    // Apply comment/uncomment to all lines
    for (let line = startLine; line <= endLine; line++) {
      const lineContent = model.getLineContent(line);
      const trimmed = lineContent.trim();

      // Skip empty lines
      if (trimmed === '') continue;

      const edit = this.toggleLineComment(editor, line, commentPattern);
      if (edit) {
        edits.push(edit);
      }
    }

    return edits;
  }

  /**
   * Main function to handle comment toggling
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco editor instance
   * @returns {boolean} - True if comment was toggled, false if not applicable
   */
  handleCommentToggle(editor) {
    const position = editor.getPosition();
    const selection = editor.getSelection();

    // Check if we're in a code block
    const { inCodeBlock, language } = this.isInCodeBlock(editor, position);

    console.log(`Comment toggle attempted - Position: ${position.lineNumber}:${position.column}, In code block: ${inCodeBlock}, Language: ${language}`);

    if (!inCodeBlock || !language) {
      // Not in a code block or no language specified
      console.log('Comment toggle: Not in a code block or no language specified');

      // Show a brief notification to the user
      NotificationService.info('Comment toggle only works inside code blocks with a specified language');
      return false;
    }

    const commentPattern = this.getCommentPattern(language);
    if (!commentPattern) {
      // Language doesn't support comments
      console.log(`Comment toggle: Language '${language}' doesn't support comments`);
      NotificationService.warning(`Comments are not supported for ${language} code blocks`);
      return false;
    }

    let edits = [];

    if (selection.isEmpty()) {
      // Single line
      const edit = this.toggleLineComment(editor, position.lineNumber, commentPattern);
      if (edit) {
        edits.push(edit);
      }
    } else {
      // Multiple lines
      edits = this.toggleMultiLineComment(
        editor,
        selection.startLineNumber,
        selection.endLineNumber,
        commentPattern
      );
    }

    if (edits.length > 0) {
      editor.executeEdits('toggle-comment', edits);
      console.log(`Comment toggle: Applied ${edits.length} edits for language '${language}'`);
      return true;
    }

    return false;
  }
}

// Export singleton instance for consistency with other services
export default new CommentService();

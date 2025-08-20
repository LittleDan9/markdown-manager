import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import { useTheme } from '../context/ThemeProvider';

const MarkdownToolbar = ({ editorRef }) => {
  const { theme } = useTheme();

  const isInCodeFence = (editor, position) => {
    const model = editor.getModel();
    const lineCount = model.getLineCount();
    let inCodeFence = false;

    // Check from start of document to current position
    for (let i = 1; i <= position.lineNumber; i++) {
      const lineContent = model.getLineContent(i);
      if (lineContent.trim().startsWith('```')) {
        inCodeFence = !inCodeFence;
      }
    }

    return inCodeFence;
  };

  const insertMarkdown = (before, after = '', placeholder = '') => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, selection.getStartPosition())) {
      return; // Don't format if in code fence
    }

    const selectedText = model.getValueInRange(selection);

    if (selectedText) {
      // Check if the selected text is already wrapped with this formatting
      const isAlreadyFormatted = selectedText.startsWith(before) && selectedText.endsWith(after);

      if (isAlreadyFormatted && before === after) {
        // Remove formatting for symmetric markers (like ** or * or `)
        const unwrappedText = selectedText.slice(before.length, -after.length);
        editor.executeEdits('markdown-toolbar', [
          {
            range: selection,
            text: unwrappedText
          }
        ]);

        // Set selection to the unwrapped text
        const startPos = selection.getStartPosition();
        const endPos = {
          lineNumber: startPos.lineNumber,
          column: startPos.column + unwrappedText.length
        };
        editor.setSelection({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        });
      } else {
        // Check if text is surrounded by the formatting (with possible whitespace)
        const beforeMarker = before;
        const afterMarker = after;

        // Get extended selection to check for surrounding markers
        const startPos = selection.getStartPosition();
        const endPos = selection.getEndPosition();

        // Extend selection backwards to check for before marker
        const extendedStartPos = {
          lineNumber: startPos.lineNumber,
          column: Math.max(1, startPos.column - beforeMarker.length)
        };

        // Extend selection forwards to check for after marker
        const extendedEndPos = {
          lineNumber: endPos.lineNumber,
          column: endPos.column + afterMarker.length
        };

        const extendedRange = {
          startLineNumber: extendedStartPos.lineNumber,
          startColumn: extendedStartPos.column,
          endLineNumber: extendedEndPos.lineNumber,
          endColumn: extendedEndPos.column
        };

        const extendedText = model.getValueInRange(extendedRange);

        if (extendedText.startsWith(beforeMarker) && extendedText.endsWith(afterMarker)) {
          // Remove the surrounding formatting
          editor.executeEdits('markdown-toolbar', [
            {
              range: extendedRange,
              text: selectedText
            }
          ]);

          // Keep the original text selected
          editor.setSelection({
            startLineNumber: extendedStartPos.lineNumber,
            startColumn: extendedStartPos.column,
            endLineNumber: extendedStartPos.lineNumber,
            endColumn: extendedStartPos.column + selectedText.length
          });
        } else {
          // Add formatting
          const newText = `${before}${selectedText}${after}`;
          editor.executeEdits('markdown-toolbar', [
            {
              range: selection,
              text: newText
            }
          ]);

          // Set cursor after the formatting
          const startPos = selection.getStartPosition();
          const endLine = startPos.lineNumber;
          const endColumn = startPos.column + newText.length;
          editor.setPosition({ lineNumber: endLine, column: endColumn });
        }
      }
    } else {
      // No selection - insert formatting with placeholder
      const position = editor.getPosition();
      const textToInsert = placeholder ? `${before}${placeholder}${after}` : `${before}${after}`;

      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          text: textToInsert
        }
      ]);

      // Position cursor in the middle of the formatting
      const newColumn = position.column + before.length + (placeholder ? placeholder.length : 0);
      editor.setPosition({ lineNumber: position.lineNumber, column: newColumn });

      // If we inserted a placeholder, select it
      if (placeholder) {
        editor.setSelection({
          startLineNumber: position.lineNumber,
          startColumn: position.column + before.length,
          endLineNumber: position.lineNumber,
          endColumn: position.column + before.length + placeholder.length
        });
      }
    }

    editor.focus();
  };

  const insertHeading = (level) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, position)) {
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);
    const headingMarks = '#'.repeat(level);

    // If line is empty or doesn't start with #, add heading
    if (!lineContent.trim() || !lineContent.trim().startsWith('#')) {
      const newText = lineContent.trim() ? `${headingMarks} ${lineContent.trim()}` : `${headingMarks} Heading ${level}`;

      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: lineContent.length + 1
          },
          text: newText
        }
      ]);

      // Select the heading text (excluding the # marks)
      editor.setSelection({
        startLineNumber: position.lineNumber,
        startColumn: headingMarks.length + 2,
        endLineNumber: position.lineNumber,
        endColumn: newText.length + 1
      });
    }

    editor.focus();
  };

    const insertList = (ordered = false) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, position)) {
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);
    const listMarker = ordered ? '1. ' : '- ';

    if (lineContent.trim() === '') {
      // Empty line - add list item
      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: lineContent.length + 1
          },
          text: `${listMarker}List item`
        }
      ]);

      // Select "List item" text
      editor.setSelection({
        startLineNumber: position.lineNumber,
        startColumn: listMarker.length + 1,
        endLineNumber: position.lineNumber,
        endColumn: listMarker.length + 10
      });
    } else {
      // Add list marker to existing text
      const newText = `${listMarker}${lineContent.trim()}`;
      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: lineContent.length + 1
          },
          text: newText
        }
      ]);
    }

    editor.focus();
  };

  const insertHorizontalRule = () => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, position)) {
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);

    // If current line is not empty, add a new line before the HR
    const hrText = lineContent.trim() === '' ? '---' : '\n---';

    editor.executeEdits('markdown-toolbar', [
      {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: lineContent.length + 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: hrText
      }
    ]);

    // Position cursor after the HR
    const newLineNumber = lineContent.trim() === '' ? position.lineNumber : position.lineNumber + 1;
    editor.setPosition({
      lineNumber: newLineNumber + 1,
      column: 1
    });

    editor.focus();
  };

  const toolbarStyle = {
    padding: '8px 12px',
    backgroundColor: theme === 'dark' ? 'var(--bs-dark)' : 'var(--bs-light)',
  };

  const buttonVariant = theme === 'dark' ? 'outline-light' : 'outline-secondary';

  const buttonStyle = {
    border: 'none',
    padding: '4px 8px',
    margin: '0 2px',
    color: theme === 'dark' ? '#fff' : '#6c757d'
  };

  // Add custom CSS for proper hover states
  React.useEffect(() => {
    const styleId = 'markdown-toolbar-styles';
    let existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      existingStyle = document.createElement('style');
      existingStyle.id = styleId;
      document.head.appendChild(existingStyle);
    }

    existingStyle.textContent = `
      .markdown-toolbar .btn-outline-light:hover {
        color: #000 !important;
        background-color: #f8f9fa !important;
        border-color: #f8f9fa !important;
      }

      .markdown-toolbar .btn-outline-secondary:hover {
        color: #fff !important;
        background-color: #6c757d !important;
        border-color: #6c757d !important;
      }
    `;
  }, [theme]);

  const separatorStyle = {
    borderLeft: `1px solid ${theme === 'dark' ? '#495057' : '#dee2e6'}`,
    height: '24px'
  };

  return (
    <div className="markdown-toolbar d-flex align-items-center gap-2" style={toolbarStyle}>
      {/* Text Formatting */}
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('**', '**', 'bold text')}
          title="Bold (Ctrl+B)"
        >
          <i className="bi bi-type-bold"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('*', '*', 'italic text')}
          title="Italic (Ctrl+I)"
        >
          <i className="bi bi-type-italic"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('`', '`', 'code')}
          title="Inline Code"
        >
          <i className="bi bi-code"></i>
        </Button>
      </ButtonGroup>

      <div style={separatorStyle} />

      {/* Headings */}
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertHeading(1)}
          title="Heading 1"
        >
          H1
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertHeading(2)}
          title="Heading 2"
        >
          H2
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertHeading(3)}
          title="Heading 3"
        >
          H3
        </Button>
      </ButtonGroup>

      <div style={separatorStyle} />

      {/* Lists */}
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertList(false)}
          title="Unordered List"
        >
          <i className="bi bi-list-ul"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertList(true)}
          title="Ordered List"
        >
          <i className="bi bi-list-ol"></i>
        </Button>
      </ButtonGroup>

      <div style={separatorStyle} />

      {/* Links & Media */}
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('[', '](url)', 'link text')}
          title="Link"
        >
          <i className="bi bi-link-45deg"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('![', '](image-url)', 'alt text')}
          title="Image"
        >
          <i className="bi bi-image"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('> ', '', 'quote text')}
          title="Quote"
        >
          <i className="bi bi-quote"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={insertHorizontalRule}
          title="Horizontal Rule"
        >
          <i className="bi bi-dash-lg"></i>
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default MarkdownToolbar;

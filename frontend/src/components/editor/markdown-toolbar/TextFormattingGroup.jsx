import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

/**
 * Text formatting toolbar group (Bold, Italic, Inline Code)
 */
export function TextFormattingGroup({ insertMarkdown, buttonVariant, buttonStyle }) {
  return (
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
  );
}

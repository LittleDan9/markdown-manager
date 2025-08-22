import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

/**
 * Media and Links toolbar group (Link, Image, Quote, Horizontal Rule)
 */
export function MediaGroup({ insertMarkdown, insertHorizontalRule, buttonVariant, buttonStyle }) {
  return (
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
  );
}

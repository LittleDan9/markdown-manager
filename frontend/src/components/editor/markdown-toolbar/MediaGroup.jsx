import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Dropdown, DropdownButton } from 'react-bootstrap';

/**
 * Media and Links toolbar group (Link, Image, Quote, Horizontal Rule) - responsive version
 * Shows individual buttons on wider screens, dropdown on narrow screens
 */
export function MediaGroup({ insertMarkdown, insertHorizontalRule, buttonVariant, buttonStyle }) {
  const [useDropdown, setUseDropdown] = useState(false);

  // Check container width to determine if we should use dropdown
  useEffect(() => {
    const checkWidth = () => {
      const toolbar = document.querySelector('.markdown-toolbar');
      if (toolbar) {
        const toolbarWidth = toolbar.offsetWidth;
        // Switch to dropdown if toolbar width is less than 500px (earlier than headings)
        setUseDropdown(toolbarWidth < 500);
      }
    };

    // Initial check
    checkWidth();

    // Listen for window resize
    window.addEventListener('resize', checkWidth);

    // Use ResizeObserver for more accurate toolbar width changes
    let observer;
    const toolbar = document.querySelector('.markdown-toolbar');
    if (toolbar && window.ResizeObserver) {
      observer = new ResizeObserver(checkWidth);
      observer.observe(toolbar);
    }

    return () => {
      window.removeEventListener('resize', checkWidth);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  if (useDropdown) {
    return (
      <DropdownButton
        as={ButtonGroup}
        id="media-dropdown"
        title={<i className="bi bi-paperclip"></i>}
        variant={buttonVariant}
        size="sm"
        style={{
          ...buttonStyle,
          height: '27px',
          display: 'flex',
          alignItems: 'center'
        }}
        className="media-dropdown"
      >
        <Dropdown.Item onClick={() => insertMarkdown('[', '](url)', 'link text')}>
          <i className="bi bi-link-45deg me-2"></i>
          <strong>Link</strong>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => insertMarkdown('![', '](image-url)', 'alt text')}>
          <i className="bi bi-image me-2"></i>
          <strong>Image</strong>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => insertMarkdown('> ', '', 'quote text')}>
          <i className="bi bi-quote me-2"></i>
          <strong>Quote</strong>
        </Dropdown.Item>
        <Dropdown.Item onClick={insertHorizontalRule}>
          <i className="bi bi-dash-lg me-2"></i>
          <strong>Horizontal Rule</strong>
        </Dropdown.Item>
      </DropdownButton>
    );
  }

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

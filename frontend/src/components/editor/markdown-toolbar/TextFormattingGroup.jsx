import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Dropdown, DropdownButton } from 'react-bootstrap';

/**
 * Text formatting toolbar group (Bold, Italic, Inline Code) - responsive version
 * Shows individual buttons on wider screens, dropdown on narrow screens
 */
export function TextFormattingGroup({ insertMarkdown, buttonVariant, buttonStyle }) {
  const [useDropdown, setUseDropdown] = useState(false);

  // Check container width to determine if we should use dropdown
  useEffect(() => {
    const checkWidth = () => {
      const toolbar = document.querySelector('.markdown-toolbar');
      if (toolbar) {
        const toolbarWidth = toolbar.offsetWidth;
        // Switch to dropdown if toolbar width is less than 400px (most aggressive compression)
        setUseDropdown(toolbarWidth < 400);
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
        id="format-dropdown"
        title={<i className="bi bi-type-bold"></i>}
        variant={buttonVariant}
        size="sm"
        style={{
          ...buttonStyle,
          height: '27px',
          display: 'flex',
          alignItems: 'center'
        }}
        className="format-dropdown"
      >
        <Dropdown.Item onClick={() => insertMarkdown('**', '**', 'bold text')}>
          <i className="bi bi-type-bold me-2"></i>
          <strong>Bold</strong> <span className="text-muted">(Ctrl+B)</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => insertMarkdown('*', '*', 'italic text')}>
          <i className="bi bi-type-italic me-2"></i>
          <strong>Italic</strong> <span className="text-muted">(Ctrl+I)</span>
        </Dropdown.Item>
        <Dropdown.Item onClick={() => insertMarkdown('`', '`', 'code')}>
          <i className="bi bi-code me-2"></i>
          <strong>Inline Code</strong>
        </Dropdown.Item>
      </DropdownButton>
    );
  }

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

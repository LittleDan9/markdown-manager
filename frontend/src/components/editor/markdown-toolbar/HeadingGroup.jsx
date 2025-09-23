import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Dropdown, DropdownButton } from 'react-bootstrap';

/**
 * Heading toolbar group (H1, H2, H3) - responsive version
 * Shows individual buttons on wider screens, dropdown on narrow screens
 */
export function HeadingGroup({ insertHeading, buttonVariant, buttonStyle }) {
  const [useDropdown, setUseDropdown] = useState(false);

  // Check container width to determine if we should use dropdown
  useEffect(() => {
    const checkWidth = () => {
      const toolbar = document.querySelector('.markdown-toolbar');
      if (toolbar) {
        const toolbarWidth = toolbar.offsetWidth;
        // Switch to dropdown if toolbar width is less than 600px
        setUseDropdown(toolbarWidth < 600);
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
        id="heading-dropdown"
        title="H"
        variant={buttonVariant}
        size="sm"
        style={{
          ...buttonStyle,
          height: '27px', // Match the actual height of regular buttons
          display: 'flex',
          alignItems: 'center'
        }}
        className="heading-dropdown"
      >
        <Dropdown.Item onClick={() => insertHeading(1)}>
          <strong>H1</strong> - Heading 1
        </Dropdown.Item>
        <Dropdown.Item onClick={() => insertHeading(2)}>
          <strong>H2</strong> - Heading 2
        </Dropdown.Item>
        <Dropdown.Item onClick={() => insertHeading(3)}>
          <strong>H3</strong> - Heading 3
        </Dropdown.Item>
      </DropdownButton>
    );
  }

  return (
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
  );
}

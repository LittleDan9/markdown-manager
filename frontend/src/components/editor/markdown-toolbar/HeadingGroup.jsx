import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

/**
 * Heading toolbar group (H1, H2, H3)
 */
export function HeadingGroup({ insertHeading, buttonVariant, buttonStyle }) {
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

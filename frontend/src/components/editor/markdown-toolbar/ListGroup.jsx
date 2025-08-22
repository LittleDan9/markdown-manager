import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

/**
 * List toolbar group (Unordered, Ordered)
 */
export function ListGroup({ insertList, buttonVariant, buttonStyle }) {
  return (
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
  );
}

import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

/**
 * Spell Check toolbar group
 */
export function SpellCheckGroup({ onSpellCheck, buttonVariant, buttonStyle }) {
  return (
    <ButtonGroup size="sm">
      <Button
        variant={buttonVariant}
        style={buttonStyle}
        onClick={onSpellCheck}
        title="Run Spell Check"
      >
        <i className="bi bi-spellcheck"></i>
      </Button>
    </ButtonGroup>
  );
}

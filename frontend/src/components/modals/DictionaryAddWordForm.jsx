import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

/**
 * Add word form component
 */
export function DictionaryAddWordForm({ 
  newWord, 
  setNewWord, 
  newWordNotes, 
  setNewWordNotes, 
  onSubmit, 
  loading 
}) {
  return (
    <Form onSubmit={onSubmit} className="mb-3">
      <Form.Group className="mb-3">
        <Form.Label>Add New Word</Form.Label>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Enter word..."
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            disabled={loading}
            required
          />
          <Button 
            variant="primary" 
            type="submit" 
            disabled={loading || !newWord.trim()}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Adding...
              </>
            ) : (
              'Add Word'
            )}
          </Button>
        </InputGroup>
      </Form.Group>
      
      <Form.Group className="mb-3">
        <Form.Label>Notes (Optional)</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          placeholder="Add notes about this word..."
          value={newWordNotes}
          onChange={(e) => setNewWordNotes(e.target.value)}
          disabled={loading}
        />
        <Form.Text className="text-muted">
          Notes help you remember context or special usage for this word.
        </Form.Text>
      </Form.Group>
    </Form>
  );
}

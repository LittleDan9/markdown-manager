import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DocumentProvider, useDocument } from '../src/context/document';

function IntegrationComponent() {
  const { createDocument, saveDocument, documents, currentDocument } = useDocument();
  return (
    <div>
      <button onClick={() => createDocument('Integration Doc', 'General')}>Create</button>
      <button onClick={async () => await saveDocument({ ...currentDocument, name: 'Saved Doc' })}>Save</button>
      <span data-testid="doc-count">{documents.length}</span>
      <span data-testid="doc-name">{currentDocument.name}</span>
    </div>
  );
}

describe('DocumentProvider Integration', () => {
  it('creates and saves a document', async () => {
    const { getByText, getByTestId } = render(
      <DocumentProvider>
        <IntegrationComponent />
      </DocumentProvider>
    );
    act(() => {
      getByText('Create').click();
    });
    expect(getByTestId('doc-name').textContent).toBe('Integration Doc');
    await act(async () => {
      getByText('Save').click();
    });
    await waitFor(() => {
      expect(getByTestId('doc-name').textContent).toBe('Saved Doc');
    });
  });
});

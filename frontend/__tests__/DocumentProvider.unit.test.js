import React from 'react';
import { render, act } from '@testing-library/react';
import { DocumentProvider, useDocument } from '../src/context/document';

function TestComponent() {
  const { currentDocument, createDocument, setCurrentDocument } = useDocument();
  return (
    <div>
      <span data-testid="doc-name">{currentDocument.name}</span>
      <button onClick={() => createDocument('Test Doc', 'General')}>Create</button>
      <button onClick={() => setCurrentDocument({ id: 1, name: 'Manual', category: 'General', content: 'abc' })}>Set</button>
    </div>
  );
}

describe('DocumentProvider Unit', () => {
  it('provides default document', () => {
    const { getByTestId } = render(
      <DocumentProvider>
        <TestComponent />
      </DocumentProvider>
    );
    expect(getByTestId('doc-name').textContent).toBe('Untitled Document');
  });

  it('can create a new document', () => {
    const { getByTestId, getByText } = render(
      <DocumentProvider>
        <TestComponent />
      </DocumentProvider>
    );
    act(() => {
      getByText('Create').click();
    });
    expect(getByTestId('doc-name').textContent).toBe('Test Doc');
  });

  it('can set current document manually', () => {
    const { getByTestId, getByText } = render(
      <DocumentProvider>
        <TestComponent />
      </DocumentProvider>
    );
    act(() => {
      getByText('Set').click();
    });
    expect(getByTestId('doc-name').textContent).toBe('Manual');
  });
});

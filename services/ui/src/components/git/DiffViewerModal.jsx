import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, Alert, Spinner } from 'react-bootstrap';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import documentsApi from '@/api/documentsApi';

/**
 * DiffViewerModal — shows a Monaco side-by-side diff between two git commits.
 * originalHash: older commit (left)
 * modifiedHash: newer commit (right, or HEAD)
 */
export default function DiffViewerModal({ show, onHide, documentId, originalHash, modifiedHash, title }) {
  const containerRef = useRef(null);
  const diffEditorRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Fetched content kept separate from loading state so the container div
  // stays in the DOM while we fetch (otherwise containerRef becomes null)
  const [diffContent, setDiffContent] = useState(null);

  // Dispose the Monaco diff editor and its models on cleanup
  const disposeEditor = () => {
    if (diffEditorRef.current) {
      const model = diffEditorRef.current.getModel();
      diffEditorRef.current.dispose();
      model?.original?.dispose();
      model?.modified?.dispose();
      diffEditorRef.current = null;
    }
  };

  // Effect 1: fetch content when the modal opens / hashes change
  useEffect(() => {
    if (!show || !documentId || !originalHash) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiffContent(null);
    disposeEditor();

    const fetchContent = async () => {
      try {
        const [origResult, modResult] = await Promise.all([
          documentsApi.getDocumentAtCommit(documentId, originalHash),
          modifiedHash
            ? documentsApi.getDocumentAtCommit(documentId, modifiedHash)
            : Promise.resolve({ content: '' }),
        ]);

        if (!cancelled) {
          setDiffContent({
            original: origResult.content ?? '',
            modified: modResult.content ?? '',
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load diff');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchContent();
    return () => { cancelled = true; };
  }, [show, documentId, originalHash, modifiedHash]);

  // Effect 2: initialize Monaco once content is ready AND the container div is mounted
  useEffect(() => {
    if (!diffContent || !containerRef.current) return;

    disposeEditor();

    const originalModel = monaco.editor.createModel(diffContent.original, 'markdown');
    const modifiedModel = monaco.editor.createModel(diffContent.modified, 'markdown');

    diffEditorRef.current = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      renderSideBySide: true,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 13,
      wordWrap: 'on',
    });

    diffEditorRef.current.setModel({ original: originalModel, modified: modifiedModel });
  }, [diffContent]);

  // Dispose editor when modal closes
  useEffect(() => {
    if (!show) {
      disposeEditor();
      setDiffContent(null);
      setError(null);
    }
  }, [show]);

  const handleHide = () => {
    disposeEditor();
    onHide();
  };

  return (
    <Modal show={show} onHide={handleHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-file-diff me-2"></i>
          {title || 'Diff Viewer'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && (
          <div className="text-center py-5">
            <Spinner animation="border" role="status" className="me-2" />
            <span>Loading diff…</span>
          </div>
        )}

        {error && (
          <Alert variant="danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        )}

        {/*
          Always keep the container div in the DOM once content is ready so that
          containerRef is valid when Effect 2 runs Monaco initialization.
          The div is hidden while loading/erroring to avoid a flash of empty space.
        */}
        <div
          ref={containerRef}
          style={{
            height: '65vh',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            display: loading || error || !diffContent ? 'none' : 'block',
          }}
        />
      </Modal.Body>
    </Modal>
  );
}

DiffViewerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  documentId: PropTypes.number,
  originalHash: PropTypes.string,
  modifiedHash: PropTypes.string,
  title: PropTypes.string,
};

import React, { useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Editor from '../Editor';
import OutlinePanel from '../editor/OutlinePanel';
import CommentsPanel from '../editor/CommentsPanel';
import useDocumentOutline from '../../hooks/ui/useDocumentOutline';
import useComments from '../../hooks/ui/useComments';
import useCollaboration from '../../hooks/editor/useCollaboration';
import collaborationApi from '../../api/collaborationApi';
import { useDocumentContext } from '../../providers/DocumentContextProvider';

/**
 * EditorSection - Wrapper component for the editor area
 * Handles editor rendering with loading states, outline panel, comments, and conditional visibility
 */
function EditorSection({
  isSharedView,
  isInitializing,
  currentDocument,
  fullscreenPreview
}) {
  const { content } = useDocumentContext();
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [hasCollaborators, setHasCollaborators] = useState(false);
  const { headingTree, activeHeadingLine, hasHeadings } = useDocumentOutline();
  const { comments, total: commentTotal, loading: commentsLoading, addComment, resolveComment, removeComment } = useComments(currentDocument?.id);

  // Check if document has collaborators (determines whether collab mode activates)
  useEffect(() => {
    if (!currentDocument?.id) {
      setHasCollaborators(false);
      return;
    }
    let cancelled = false;
    collaborationApi.getCollaborators(currentDocument.id)
      .then(data => {
        if (!cancelled) setHasCollaborators(data.has_collaborators);
      })
      .catch(() => {
        if (!cancelled) setHasCollaborators(false);
      });
    return () => { cancelled = true; };
  }, [currentDocument?.id]);

  const collab = useCollaboration(currentDocument?.id, hasCollaborators);

  const handleOutlineHeadingClick = useCallback((line) => {
    window.dispatchEvent(new CustomEvent('outline-navigate', { detail: { line } }));
  }, []);

  const toggleOutline = useCallback(() => {
    setOutlineVisible(prev => !prev);
  }, []);

  const toggleComments = useCallback(() => {
    setCommentsVisible(prev => !prev);
  }, []);

  if (isSharedView) {
    return null;
  }

  return (
    <div id="editorContainer">
      {!isInitializing ? (
        <div style={{ display: 'flex', height: '100%' }}>
          <OutlinePanel
            headingTree={headingTree}
            activeHeadingLine={activeHeadingLine}
            onHeadingClick={handleOutlineHeadingClick}
            visible={outlineVisible}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Editor
              value={content}
              categoryId={currentDocument?.category_id}
              fullscreenPreview={fullscreenPreview}
              onToggleOutline={toggleOutline}
              outlineVisible={outlineVisible}
              hasOutlineHeadings={hasHeadings}
              onToggleComments={toggleComments}
              commentsVisible={commentsVisible}
              commentCount={commentTotal}
              collab={collab}
            />
          </div>
          <CommentsPanel
            comments={comments}
            total={commentTotal}
            loading={commentsLoading}
            onAdd={addComment}
            onResolve={resolveComment}
            onDelete={removeComment}
            visible={commentsVisible}
          />
        </div>
      ) : (
        <div style={{ height: "100%", width: "100%", position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="editor-loading-container">
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Initializing authentication...</span>
              </div>
              <div>
                <small className="text-muted">Loading editor...</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

EditorSection.propTypes = {
  isSharedView: PropTypes.bool.isRequired,
  isInitializing: PropTypes.bool.isRequired,
  currentDocument: PropTypes.object,
  fullscreenPreview: PropTypes.bool.isRequired,
};

export default EditorSection;

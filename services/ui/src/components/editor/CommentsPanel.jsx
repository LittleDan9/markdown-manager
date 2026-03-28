import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';

/**
 * CommentsPanel — Sidebar panel showing document comments with add/resolve/reply.
 *
 * In collab mode (collabActive=true), uses "Comment at cursor" instead of manual line input.
 * Anchor data (anchor_text, anchor_ypos) is attached for CRDT-stable positioning.
 */
function CommentsPanel({ comments, total, loading, onAdd, onResolve, onDelete, visible, collabActive, cursorLine, onCreateAnchor }) {
  const [newContent, setNewContent] = useState('');
  const [newLine, setNewLine] = useState('');

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const payload = { content: newContent.trim() };

    if (collabActive && onCreateAnchor && cursorLine) {
      // In collab mode, create a Y.RelativePosition anchor at cursor
      const anchor = await onCreateAnchor(cursorLine);
      if (anchor) {
        payload.anchorText = anchor.anchorText;
        payload.anchorYpos = anchor.anchorYpos;
      }
      payload.lineNumber = cursorLine;
    } else {
      // Solo mode — manual line number
      payload.lineNumber = newLine ? parseInt(newLine, 10) : null;
    }

    onAdd(payload);
    setNewContent('');
    setNewLine('');
  };

  return (
    <div className="comments-panel">
      <div className="comments-panel-header d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
        <strong>Comments ({total})</strong>
      </div>

      <form onSubmit={handleSubmit} className="px-3 py-2 border-bottom">
        <textarea
          className="form-control form-control-sm mb-2"
          rows={2}
          placeholder="Add a comment..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="d-flex gap-2 align-items-center">
          {collabActive ? (
            <span className="text-muted small">
              {cursorLine ? (
                <>
                  <i className="bi bi-cursor-text me-1" />
                  Line {cursorLine}
                </>
              ) : (
                'Place cursor to anchor'
              )}
            </span>
          ) : (
            <input
              type="number"
              className="form-control form-control-sm"
              placeholder="Line #"
              style={{ width: '80px' }}
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              min={1}
            />
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={!newContent.trim()}>
            Add
          </button>
        </div>
      </form>

      <div className="comments-list" style={{ overflowY: 'auto', flex: 1 }}>
        {loading && comments.length === 0 && (
          <div className="text-center text-muted py-3">
            <div className="spinner-border spinner-border-sm" role="status" />
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div className="text-center text-muted py-4">
            <i className="bi bi-chat-left-text d-block mb-2" style={{ fontSize: '1.5em' }} />
            No comments yet
          </div>
        )}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onResolve={onResolve}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment, onResolve, onDelete, depth = 0 }) {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const isResolved = comment.status === 'resolved';
  const hasAnchor = !!comment.anchor_ypos;

  return (
    <div
      className={`comment-item px-3 py-2 border-bottom ${isResolved ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <strong className="small">{comment.author?.display_name || 'Unknown'}</strong>
          {comment.line_number && (
            <span className="badge bg-secondary-subtle text-secondary ms-2" style={{ fontSize: '0.7em' }}>
              L{comment.line_number}
            </span>
          )}
          {hasAnchor && (
            <span className="badge bg-info-subtle text-info ms-1" style={{ fontSize: '0.65em' }} title="Anchored to text position">
              <i className="bi bi-pin-angle" />
            </span>
          )}
          <span className="text-muted ms-2" style={{ fontSize: '0.75em' }}>{timeAgo}</span>
        </div>
        <div className="d-flex gap-1">
          {!isResolved && (
            <button
              className="btn btn-link btn-sm p-0 text-success"
              onClick={() => onResolve(comment.id)}
              title="Resolve"
            >
              <i className="bi bi-check-lg" />
            </button>
          )}
          <button
            className="btn btn-link btn-sm p-0 text-muted"
            onClick={() => onDelete(comment.id)}
            title="Delete"
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      </div>
      <div className="small mt-1">{comment.content}</div>
      {hasAnchor && comment.anchor_text && (
        <div className="small text-muted mt-1 fst-italic" style={{ fontSize: '0.75em' }}>
          &ldquo;{comment.anchor_text}&rdquo;
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-1">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onResolve={onResolve}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

CommentsPanel.propTypes = {
  comments: PropTypes.array.isRequired,
  total: PropTypes.number.isRequired,
  loading: PropTypes.bool,
  onAdd: PropTypes.func.isRequired,
  onResolve: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  visible: PropTypes.bool.isRequired,
  collabActive: PropTypes.bool,
  cursorLine: PropTypes.number,
  onCreateAnchor: PropTypes.func,
};

CommentItem.propTypes = {
  comment: PropTypes.object.isRequired,
  onResolve: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  depth: PropTypes.number,
};

export default CommentsPanel;

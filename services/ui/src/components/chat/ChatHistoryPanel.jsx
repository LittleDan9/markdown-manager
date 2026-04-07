import React from "react";
import PropTypes from "prop-types";

const PROVIDER_ICONS = {
  ollama: "bi-cpu",
  openai: "bi-chat-dots",
  xai: "bi-lightning-charge",
  github: "bi-github",
};

function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatHistoryPanel({ conversations, loading, activeConversationId, onSelect, onDelete, onClose }) {
  return (
    <div className="chat-history-panel">
      <div className="chat-history-header">
        <h6 className="chat-history-title">
          <i className="bi bi-clock-history" />
          Chat History
        </h6>
        <button
          type="button"
          className="btn btn-sm btn-link text-secondary p-0"
          onClick={onClose}
          title="Close history"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="chat-history-list">
        {loading && (
          <div className="chat-history-empty">
            <i className="bi bi-hourglass-split" />
            Loading…
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="chat-history-empty">
            <i className="bi bi-chat-square" />
            <span>No conversation history yet</span>
          </div>
        )}

        {!loading &&
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`chat-history-item${conv.id === activeConversationId ? " active" : ""}`}
              onClick={() => onSelect(conv.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" ? onSelect(conv.id) : null)}
            >
              <div className="chat-history-item-content">
                <div className="chat-history-item-title">
                  {conv.title || conv.first_message_preview || "New conversation"}
                </div>
                <div className="chat-history-item-meta">
                  {conv.provider && (
                    <i className={`bi ${PROVIDER_ICONS[conv.provider] || "bi-robot"}`} title={conv.provider} />
                  )}
                  <span>{conv.message_count || 0} messages</span>
                  <span className="meta-sep">·</span>
                  <span>{formatRelativeDate(conv.updated_at || conv.created_at)}</span>
                </div>
              </div>
              <button
                type="button"
                className="chat-history-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                title="Delete conversation"
              >
                <i className="bi bi-trash3" />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

ChatHistoryPanel.propTypes = {
  conversations: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  activeConversationId: PropTypes.number,
  onSelect: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ChatHistoryPanel;

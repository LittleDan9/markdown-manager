import React, { useCallback, useEffect, useRef, useState } from "react";
import { Offcanvas } from "react-bootstrap";
import PropTypes from "prop-types";
import { searchApi } from "@/api/searchApi";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";

const SCOPE_ALL = "all";
const SCOPE_CURRENT = "current";

function ChatDrawer({ show, onHide }) {
  const { currentDocument } = useDocumentContext();

  const [scope, setScope] = useState(SCOPE_ALL);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cancel any in-flight stream when drawer closes
  useEffect(() => {
    if (!show && abortRef.current) {
      abortRef.current.abort();
    }
  }, [show]);

  // Default to current-doc scope when a document is open
  useEffect(() => {
    if (currentDocument && scope === SCOPE_ALL) {
      // Don't force-switch; let user choose
    }
  }, [currentDocument]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const documentId =
      scope === SCOPE_CURRENT && currentDocument ? currentDocument.id : null;

    // Append user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    // Start assistant message (empty, will be filled by streaming)
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await searchApi.askQuestion(
        question,
        documentId,
        (token) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + token,
              };
            }
            return updated;
          });
        },
        controller.signal,
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content || "An error occurred. Please try again.",
              streaming: false,
            };
          }
          return updated;
        });
      }
    } finally {
      // Mark streaming as done
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, streaming: false };
        }
        return updated;
      });
      setIsStreaming(false);
    }
  }, [input, isStreaming, scope, currentDocument]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
  };

  const hasCurrentDoc = Boolean(currentDocument);

  return (
    <Offcanvas
      show={show}
      onHide={onHide}
      placement="end"
      className="chat-drawer"
      scroll
      backdrop={false}
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title className="chat-drawer-title">
          <i className="bi bi-chat-dots-fill" />
          Ask Your Documents
          {messages.length > 0 && (
            <button
              className="btn btn-sm btn-link text-secondary ms-auto p-0"
              onClick={handleClearChat}
              title="Clear conversation"
              type="button"
            >
              <i className="bi bi-trash3" />
            </button>
          )}
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        {/* Scope toggle */}
        <div className="chat-scope-toggle">
          <button
            className={`scope-btn${scope === SCOPE_ALL ? " active" : ""}`}
            onClick={() => setScope(SCOPE_ALL)}
            type="button"
          >
            All Docs
          </button>
          <button
            className={`scope-btn${scope === SCOPE_CURRENT ? " active" : ""}`}
            onClick={() => setScope(SCOPE_CURRENT)}
            disabled={!hasCurrentDoc}
            title={!hasCurrentDoc ? "Open a document first" : "Ask about the current document"}
            type="button"
          >
            Current Doc
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <i className="bi bi-chat-square-text" />
              <div className="empty-title">Ask anything about your documents</div>
              <div className="empty-hint">
                {scope === SCOPE_ALL
                  ? "Answers are sourced from your entire document library."
                  : `Answers are limited to "${currentDocument?.name}".`}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}-message`}>
                <div className={`message-bubble${msg.streaming ? " streaming-cursor" : ""}`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={
              scope === SCOPE_CURRENT && hasCurrentDoc
                ? `Ask about "${currentDocument.name}"…`
                : "Ask a question about your documents…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming}
            aria-label="Chat input"
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            title="Send"
            type="button"
            aria-label="Send message"
          >
            {isStreaming ? (
              <i className="bi bi-stop-fill" />
            ) : (
              <i className="bi bi-send-fill" />
            )}
          </button>
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

ChatDrawer.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default ChatDrawer;

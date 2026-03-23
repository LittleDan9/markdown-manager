import React, { useCallback, useEffect, useRef, useState } from "react";
import { Offcanvas } from "react-bootstrap";
import PropTypes from "prop-types";
import MarkdownIt from "markdown-it";
import { searchApi } from "@/api/searchApi";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";

// Shared markdown-it instance — html disabled for XSS safety
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

// Detect natural-language intent to open a document.
// Returns the matched document object, or null if no clear intent.
const OPEN_INTENT_RE =
  /^(?:please\s+)?(?:open|load|show|view|read|navigate\s+to|go\s+to|switch\s+to)\s+(?:the\s+)?(?:document\s+)?["'«»]?(.+?)["'«»]?\s*[?.]?\s*$/i;

function detectOpenIntent(question, documents) {
  if (!documents?.length) return null;
  const match = question.trim().match(OPEN_INTENT_RE);
  if (!match) return null;
  const query = match[1].trim().replace(/^["'«»]|["'«»]$/g, "").trim();
  if (!query) return null;
  const ql = query.toLowerCase();
  // Exact match first, then prefix match
  return (
    documents.find((d) => d.name.toLowerCase() === ql) ||
    documents.find(
      (d) =>
        d.name.toLowerCase().startsWith(ql) ||
        ql.startsWith(d.name.toLowerCase())
    ) ||
    null
  );
}

// Wrap occurrences of document names in the rendered HTML with <a data-doc-id> links.
// Processes only text nodes (splits on HTML tags) so it never corrupts tag attributes
// or creates invalid nested anchors inside existing <a> elements.
function injectDocumentLinks(html, documents) {
  if (!html || !documents?.length) return html;
  // Longest names first to prevent shorter names eating part of longer ones
  const sorted = [...documents]
    .filter((d) => d.name && d.name.length > 2)
    .sort((a, b) => b.name.length - a.name.length);

  // Split into HTML-tag tokens and text-node tokens (tags are kept as delimiters)
  const parts = html.split(/(<[^>]*>)/);
  let anchorDepth = 0;

  const processed = parts.map((part) => {
    if (part.startsWith("<")) {
      if (/^<a\b/i.test(part)) anchorDepth++;
      else if (/^<\/a>/i.test(part)) anchorDepth = Math.max(0, anchorDepth - 1);
      return part;
    }
    // Text node — skip if we are inside an existing <a> element
    if (anchorDepth > 0) return part;
    let text = part;
    for (const doc of sorted) {
      const esc = doc.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(
        new RegExp(`(${esc})`, "gi"),
        `<a href="#" class="doc-link" data-doc-id="${doc.id}">$1</a>`
      );
    }
    return text;
  });

  return processed.join("");
}

// Format duration in milliseconds to "nn m jj s" format
const formatDuration = (durationMs) => {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes} m ${seconds} s`;
  }
  return `${seconds} s`;
};

// Format server-side metrics for display
const formatMetrics = (metrics) => {
  if (!metrics) return null;
  const parts = [];
  if (metrics.first_token_ms) parts.push(`first token ${formatDuration(metrics.first_token_ms)}`);
  if (metrics.generation_ms) parts.push(`generation ${formatDuration(metrics.generation_ms)}`);
  if (metrics.tokens) parts.push(`${metrics.tokens} tokens`);
  if (metrics.model) parts.push(metrics.model);
  return parts.join(" · ");
};

const SCOPE_ALL = "all";
const SCOPE_CURRENT = "current";

function ChatDrawer({ show, onHide }) {
  const { currentDocument, documents, loadDocument } = useDocumentContext();

  const [scope, setScope] = useState(SCOPE_ALL);
  const [deepThink, setDeepThink] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [docMenu, setDocMenu] = useState(null); // { docId, docName, x, y }

  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const docMenuRef = useRef(null);

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

  // Close doc-link dropdown on outside click
  useEffect(() => {
    if (!docMenu) return;
    const handleOutsideClick = (e) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target)) {
        setDocMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [docMenu]);

  // Event-delegation click handler for doc-link anchors injected into assistant HTML
  const handleMessagesClick = useCallback(
    (e) => {
      const link = e.target.closest("a.doc-link[data-doc-id]");
      if (!link) return;
      e.preventDefault();
      const id = parseInt(link.dataset.docId, 10);
      if (!id) return;
      const doc = documents?.find((d) => d.id === id);
      const rect = link.getBoundingClientRect();
      setDocMenu({
        docId: id,
        docName: doc?.name || "Document",
        x: rect.left,
        y: rect.bottom + 4,
      });
    },
    [documents]
  );

  const handleDocMenuOpen = useCallback(() => {
    if (!docMenu) return;
    loadDocument(docMenu.docId);
    setDocMenu(null);
  }, [docMenu, loadDocument]);

  const handleDocMenuChat = useCallback(() => {
    if (!docMenu) return;
    loadDocument(docMenu.docId);
    setScope(SCOPE_CURRENT);
    setDocMenu(null);
  }, [docMenu, loadDocument]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    // --- Open-document intent: handle locally without calling AI ---
    const docToOpen = detectOpenIntent(question, documents);
    if (docToOpen) {
      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: `Opening **${docToOpen.name}**…`, streaming: false, isAction: true },
      ]);
      try {
        await loadDocument(docToOpen.id);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.isAction) {
            updated[updated.length - 1] = { ...last, content: `✓ Opened **${docToOpen.name}**.` };
          }
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.isAction) {
            updated[updated.length - 1] = {
              ...last,
              content: `Could not open **${docToOpen.name}**. Please try again.`,
            };
          }
          return updated;
        });
      }
      return;
    }

    setInput("");
    setIsStreaming(true);

    const startTime = Date.now();

    const documentId =
      scope === SCOPE_CURRENT && currentDocument ? currentDocument.id : null;
    const useDeepThink = deepThink && scope === SCOPE_CURRENT && Boolean(currentDocument);

    // Append user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    // Start assistant message (empty, will be filled by streaming)
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true, startTime },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build conversation history from prior completed messages (last few turns)
    const priorMessages = messages
      .filter((m) => !m.streaming && !m.isAction && m.content)
      .map(({ role, content }) => ({ role, content }));

    try {
      await searchApi.askQuestion(
        question,
        documentId,
        (token) => {
          // Handle metrics object from server
          if (token && typeof token === "object" && token.type === "metrics") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, serverMetrics: token.data };
              }
              return updated;
            });
            return;
          }
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
        useDeepThink,
        priorMessages,
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        const endTime = Date.now();
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            const duration = endTime - (last.startTime || endTime);
            updated[updated.length - 1] = {
              ...last,
              content: last.content || "An error occurred. Please try again.",
              streaming: false,
              endTime,
              duration,
            };
          }
          return updated;
        });
      }
    } finally {
      // Mark streaming as done
      const endTime = Date.now();
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          const duration = endTime - (last.startTime || endTime);
          updated[updated.length - 1] = { ...last, streaming: false, endTime, duration };
        }
        return updated;
      });
      setIsStreaming(false);
    }
  }, [input, isStreaming, scope, currentDocument, deepThink, documents, loadDocument]);

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

        {/* Deep Think toggle — only visible in Current Doc scope */}
        {scope === SCOPE_CURRENT && hasCurrentDoc && (
          <div className="chat-deep-think">
            <label className="deep-think-label" htmlFor="deep-think-toggle">
              <i className="bi bi-stars" />
              Deep Think
              <span className="deep-think-hint">Full document context</span>
            </label>
            <div
              className={`deep-think-toggle${deepThink ? " on" : ""}`}
              id="deep-think-toggle"
              role="switch"
              aria-checked={deepThink}
              tabIndex={0}
              onClick={() => setDeepThink((v) => !v)}
              onKeyDown={(e) => e.key === "Enter" || e.key === " " ? setDeepThink((v) => !v) : null}
            />
          </div>
        )}

        {/* Messages */}
        {/* onClick uses event delegation to capture doc-link anchor clicks */}
        <div className="chat-messages" onClick={handleMessagesClick}>
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
                  {msg.role === "assistant" ? (
                    <div
                      // markdown-it output with doc-name links injected for completed messages
                      dangerouslySetInnerHTML={{
                        __html: msg.streaming
                          ? md.render(msg.content || "")
                          : injectDocumentLinks(md.render(msg.content || ""), documents),
                      }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "assistant" && msg.duration && !msg.streaming && (
                  <div className="message-timing">
                    {formatDuration(msg.duration)}
                    {msg.serverMetrics && (
                      <span className="message-metrics"> — {formatMetrics(msg.serverMetrics)}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Doc-link action dropdown — styled as Bootstrap dropdown */}
        {docMenu && (
          <div
            ref={docMenuRef}
            className="dropdown-menu show doc-link-menu"
            style={{ position: "fixed", left: docMenu.x, top: docMenu.y, zIndex: 1060 }}
          >
            <h6 className="dropdown-header text-truncate" style={{ maxWidth: 240 }}>
              {docMenu.docName}
            </h6>
            <button type="button" className="dropdown-item" onClick={handleDocMenuOpen}>
              <i className="bi bi-file-earmark-text me-2" />Open Document
            </button>
            <button type="button" className="dropdown-item" onClick={handleDocMenuChat}>
              <i className="bi bi-chat-dots me-2" />Chat About This Document
            </button>
          </div>
        )}

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

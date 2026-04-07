import React, { useCallback, useEffect, useRef, useState } from "react";
import { Offcanvas } from "react-bootstrap";
import PropTypes from "prop-types";
import MarkdownIt from "markdown-it";
import { searchApi } from "@/api/searchApi";
import apiKeysApi from "@/api/apiKeysApi";
import categoriesApi from "@/api/categoriesApi";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import useChatEditorActions from "@/hooks/chat/useChatEditorActions";
import useChatHistory from "@/hooks/chat/useChatHistory";
import ChatHistoryPanel from "./ChatHistoryPanel";

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

const QUICK_ACTIONS = [
  { label: "Summarize", icon: "bi-card-text", prompt: "Summarize this document concisely" },
  { label: "Expand Shorthand", icon: "bi-arrows-angle-expand", prompt: "Rewrite this converting shorthand and abbreviations into full written notes while preserving all information" },
  { label: "Improve Structure", icon: "bi-layout-text-sidebar-reverse", prompt: "Restructure and improve the layout of this document with better headings, organization, and formatting" },
  { label: "Fix Grammar", icon: "bi-spellcheck", prompt: "Fix grammar and improve clarity while preserving the original meaning" },
];

const PROVIDER_LABELS = {
  ollama: { name: "Ollama (Local)", icon: "bi-cpu" },
  openai: { name: "OpenAI", icon: "bi-chat-dots" },
  xai: { name: "xAI (Grok)", icon: "bi-lightning-charge" },
  github: { name: "GitHub Models", icon: "bi-github" },
  gemini: { name: "Google Gemini", icon: "bi-google" },
};

function ChatDrawer({ show, onHide }) {
  const { currentDocument, documents, loadDocument, editorSelection } = useDocumentContext();
  const editorActions = useChatEditorActions();
  const history = useChatHistory();

  const [scope, setScope] = useState(SCOPE_ALL);
  const [deepThink, setDeepThink] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [docMenu, setDocMenu] = useState(null); // { docId, docName, x, y }
  const [categoryFilterEnabled, setCategoryFilterEnabled] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryList, setCategoryList] = useState([]); // [{ id, name }]
  const [showHistory, setShowHistory] = useState(false);

  // Provider selection — stores {provider, keyId} for key-level selection
  const [selectedProvider, setSelectedProvider] = useState({ provider: "ollama", keyId: null });
  const [availableProviders, setAvailableProviders] = useState([{ provider: "ollama", keyId: null, label: "Ollama (Local)" }]);

  // Selection context for chat
  const [useSelection, setUseSelection] = useState(true); // auto-include editor selection
  const [replaceConfirm, setReplaceConfirm] = useState(null); // message index for confirmation

  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const docMenuRef = useRef(null);

  // Fetch categories with IDs when drawer opens
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    categoriesApi.getCategories()
      .then((cats) => { if (!cancelled) setCategoryList(cats || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [show]);

  // Load conversation list when drawer opens
  useEffect(() => {
    if (show) history.loadConversations();
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user's configured AI providers when drawer opens
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    const base = [{ provider: "ollama", keyId: null, label: "Ollama (Local)" }];
    apiKeysApi.getKeys()
      .then((data) => {
        if (cancelled) return;
        const remote = (data?.keys || [])
          .filter((k) => k.is_active)
          .map((k) => ({
            provider: k.provider,
            keyId: k.id,
            label: k.label || PROVIDER_LABELS[k.provider]?.name || k.provider,
            model: k.preferred_model,
          }));
        setAvailableProviders([...base, ...remote]);
      })
      .catch(() => { if (!cancelled) setAvailableProviders(base); });
    return () => { cancelled = true; };
  }, [show]);

  // Default selected category to the current document's category
  useEffect(() => {
    if (currentDocument?.category_id && !selectedCategoryId) {
      setSelectedCategoryId(currentDocument.category_id);
    }
  }, [currentDocument?.category_id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const categoryId = categoryFilterEnabled && scope === SCOPE_ALL && selectedCategoryId
      ? selectedCategoryId : null;
    const selectionText = useSelection && editorSelection?.text ? editorSelection.text : null;

    // Ensure a conversation exists for persistence
    let convId = history.activeConversationId;
    if (!convId) {
      const conv = await history.createConversation(selectedProvider.provider, scope, documentId);
      convId = conv?.id || null;
    }

    // Append user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    // Persist user message (fire-and-forget)
    if (convId) {
      history.saveMessage(convId, "user", question);
    }

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
        categoryId,
        selectedProvider.provider !== "ollama" ? selectedProvider.provider : null,
        selectionText,
        selectedProvider.keyId || null,
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
      // Mark streaming as done and persist assistant message
      const endTime = Date.now();
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          const duration = endTime - (last.startTime || endTime);
          updated[updated.length - 1] = { ...last, streaming: false, endTime, duration };

          // Persist assistant message (fire-and-forget)
          if (convId && last.content) {
            const metaObj = {};
            if (duration) metaObj.duration = duration;
            if (last.serverMetrics) metaObj.serverMetrics = last.serverMetrics;
            const metaJson = Object.keys(metaObj).length ? JSON.stringify(metaObj) : null;
            history.saveMessage(convId, "assistant", last.content, metaJson);

            // Generate title after first assistant response in this conversation
            if (updated.filter((m) => m.role === "assistant" && !m.isAction && m.content).length <= 1) {
              history.generateTitle(convId, selectedProvider.provider);
            }
          }
        }
        return updated;
      });
      setIsStreaming(false);
    }
  }, [input, isStreaming, scope, currentDocument, deepThink, documents, loadDocument, categoryFilterEnabled, selectedCategoryId, selectedProvider, useSelection, editorSelection, history, messages]);

  // Quick action handler — sets scope to Current Doc and sends the preset prompt
  const handleQuickAction = useCallback((prompt) => {
    if (isStreaming) return;
    if (currentDocument) {
      setScope(SCOPE_CURRENT);
    }
    setInput(prompt);
    // Auto-send after a tick so state is updated
    setTimeout(() => {
      const sendBtn = document.querySelector('.chat-send-btn');
      if (sendBtn) sendBtn.click();
    }, 50);
  }, [isStreaming, currentDocument]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsStreaming(false);
    history.clearActive();
    setShowHistory(false);
  };

  const handleHistorySelect = async (conversationId) => {
    const detail = await history.loadConversation(conversationId);
    if (detail) {
      const restored = (detail.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        streaming: false,
        ...(m.metadata_json ? (() => { try { return JSON.parse(m.metadata_json); } catch { return {}; } })() : {}),
      }));
      setMessages(restored);
      if (detail.scope) setScope(detail.scope);
        if (detail.provider) {
          // Find a matching available provider entry, or fall back to type-only
          const match = availableProviders.find((p) => p.provider === detail.provider) ||
            { provider: detail.provider, keyId: null };
          setSelectedProvider(match);
        }
    }
    setShowHistory(false);
  };

  const handleHistoryDelete = async (conversationId) => {
    const deleted = await history.deleteConversation(conversationId);
    if (deleted && history.activeConversationId === conversationId) {
      setMessages([]);
    }
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
          <div className="chat-header-actions ms-auto">
            <button
              className="btn btn-sm btn-link text-secondary p-0"
              onClick={() => setShowHistory((v) => !v)}
              title="Chat history"
              type="button"
            >
              <i className="bi bi-clock-history" />
            </button>
            <button
              className="btn btn-sm btn-link text-secondary p-0"
              onClick={handleNewChat}
              title="New chat"
              type="button"
            >
              <i className="bi bi-plus-lg" />
            </button>
          </div>
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        {/* Chat history overlay */}
        {showHistory && (
          <ChatHistoryPanel
            conversations={history.conversations}
            loading={history.loading}
            activeConversationId={history.activeConversationId}
            onSelect={handleHistorySelect}
            onDelete={handleHistoryDelete}
            onClose={() => setShowHistory(false)}
          />
        )}
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

        {/* Provider selector */}
        {availableProviders.length > 1 && (
          <div className="chat-provider-selector">
            <label className="provider-label" htmlFor="provider-select">
              <i className="bi bi-robot" />
              Provider
            </label>
            <select
              id="provider-select"
              className="provider-select"
              value={selectedProvider.keyId ? `key:${selectedProvider.keyId}` : selectedProvider.provider}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith("key:")) {
                  const kid = parseInt(val.slice(4), 10);
                  const match = availableProviders.find((p) => p.keyId === kid);
                  if (match) setSelectedProvider(match);
                } else {
                  const match = availableProviders.find((p) => p.provider === val && !p.keyId);
                  if (match) setSelectedProvider(match);
                }
              }}
            >
              {availableProviders.map((p) => (
                <option key={p.keyId ? `key:${p.keyId}` : p.provider} value={p.keyId ? `key:${p.keyId}` : p.provider}>
                  {p.label}{p.model ? ` (${p.model})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category filter — only visible in All Docs scope */}
        {scope === SCOPE_ALL && categoryList.length > 0 && (
          <div className="chat-category-filter">
            <div className="category-filter-row">
              <label className="category-filter-label" htmlFor="category-filter-toggle">
                <i className="bi bi-funnel" />
                Category
                <span className="category-filter-hint">Limit to one category</span>
              </label>
              <div
                className={`category-filter-toggle${categoryFilterEnabled ? " on" : ""}`}
                id="category-filter-toggle"
                role="switch"
                aria-checked={categoryFilterEnabled}
                tabIndex={0}
                onClick={() => setCategoryFilterEnabled((v) => !v)}
                onKeyDown={(e) => e.key === "Enter" || e.key === " " ? setCategoryFilterEnabled((v) => !v) : null}
              />
            </div>
            {categoryFilterEnabled && (
              <select
                className="category-filter-select"
                value={selectedCategoryId || ""}
                onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value, 10) : null)}
                aria-label="Select category"
              >
                <option value="">All categories</option>
                {categoryList.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

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
                  ? categoryFilterEnabled && selectedCategoryId
                    ? `Answers are sourced from documents in the "${categoryList.find((c) => c.id === selectedCategoryId)?.name || "selected"}" category.`
                    : "Answers are sourced from your entire document library."
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
                {/* Action buttons for completed assistant messages */}
                {msg.role === "assistant" && !msg.streaming && msg.content && !msg.isAction && (
                  <div className="message-actions">
                    {replaceConfirm === idx ? (
                      <span className="replace-confirm">
                        <span className="replace-confirm-text">Replace entire document?</span>
                        <button type="button" className="action-btn confirm-yes" title="Yes, replace" onClick={() => { editorActions.replaceDocument(msg.content); setReplaceConfirm(null); }}>
                          <i className="bi bi-check-lg" />
                        </button>
                        <button type="button" className="action-btn confirm-no" title="Cancel" onClick={() => setReplaceConfirm(null)}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </span>
                    ) : (
                      <>
                        <button type="button" className="action-btn" title="Insert at cursor" onClick={() => editorActions.insertAtCursor(msg.content)}>
                          <i className="bi bi-cursor-text" />
                        </button>
                        <button type="button" className="action-btn" title="Replace selection" disabled={!editorSelection?.text} onClick={() => editorActions.replaceSelection(msg.content)}>
                          <i className="bi bi-input-cursor" />
                        </button>
                        <button type="button" className="action-btn" title="Replace document" onClick={() => setReplaceConfirm(idx)}>
                          <i className="bi bi-file-earmark-arrow-up" />
                        </button>
                        <button type="button" className="action-btn" title="Append to document" onClick={() => editorActions.appendToDocument(msg.content)}>
                          <i className="bi bi-file-earmark-plus" />
                        </button>
                        <button type="button" className="action-btn" title="Copy to clipboard" onClick={() => editorActions.copyToClipboard(msg.content)}>
                          <i className="bi bi-clipboard" />
                        </button>
                      </>
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
          {/* Selection context pill */}
          {editorSelection?.text && useSelection && (
            <div className="chat-selection-pill">
              <i className="bi bi-cursor-text" />
              <span className="selection-text" title={editorSelection.text}>
                Selection: {editorSelection.text.length > 50 ? editorSelection.text.slice(0, 50) + "…" : editorSelection.text}
              </span>
              <button type="button" className="selection-dismiss" onClick={() => setUseSelection(false)} title="Don't include selection">
                <i className="bi bi-x" />
              </button>
            </div>
          )}
          {editorSelection?.text && !useSelection && (
            <button type="button" className="chat-selection-restore" onClick={() => setUseSelection(true)}>
              <i className="bi bi-cursor-text me-1" />Include selection
            </button>
          )}

          {/* Quick actions */}
          {hasCurrentDoc && !isStreaming && (
            <div className="chat-quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="quick-action-btn"
                  onClick={() => handleQuickAction(action.prompt)}
                  title={action.prompt}
                >
                  <i className={`bi ${action.icon}`} />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
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

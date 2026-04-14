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
  const [strictContext, setStrictContext] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [docMenu, setDocMenu] = useState(null); // { docId, docName, x, y }
  const [categoryFilterEnabled, setCategoryFilterEnabled] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryList, setCategoryList] = useState([]); // [{ id, name }]
  const [showHistory, setShowHistory] = useState(false);

  // Provider selection — stores {provider, keyId} for key-level selection
  // Initialise from localStorage so the last-used provider/model persists across sessions.
  const [selectedProvider, setSelectedProvider] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("chat_provider"));
      if (saved?.provider) return saved;
    } catch { /* ignore */ }
    return { provider: "ollama", keyId: null };
  });
  const [availableProviders, setAvailableProviders] = useState([{ provider: "ollama", keyId: null, label: "Ollama (Local)" }]);

  // Model picker state
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem("chat_model") || null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelList, setModelList] = useState([]); // array of {id, name?, ...} dicts
  const [modelListLoading, setModelListLoading] = useState(false);
  const [modelListError, setModelListError] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [pickerProvider, setPickerProvider] = useState(null); // provider being browsed in popover
  const modelPickerRef = useRef(null);

  // Selection context for chat
  const [useSelection, setUseSelection] = useState(true); // auto-include editor selection
  const [replaceConfirm, setReplaceConfirm] = useState(null); // message index for confirmation

  // Edit mode state
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editInput, setEditInput] = useState("");
  const editTextareaRef = useRef(null);

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

  // Restore the persisted active conversation when drawer opens with no messages loaded
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!show || restoredRef.current || messages.length > 0) return;
    const persistedId = history.activeConversationId;
    if (!persistedId) return;
    restoredRef.current = true;
    // Load the persisted conversation; clear stale ID on failure (e.g. deleted)
    handleHistorySelect(persistedId).catch(() => {
      history.clearActive();
    });
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

  // Persist provider/model selection to localStorage
  useEffect(() => {
    try { localStorage.setItem("chat_provider", JSON.stringify({ provider: selectedProvider.provider, keyId: selectedProvider.keyId })); } catch { /* ignore */ }
  }, [selectedProvider]);
  useEffect(() => {
    try {
      if (selectedModel) localStorage.setItem("chat_model", selectedModel);
      else localStorage.removeItem("chat_model");
    } catch { /* ignore */ }
  }, [selectedModel]);

  // Validate saved provider still exists once available providers finish loading
  useEffect(() => {
    if (availableProviders.length <= 1) return; // only default Ollama loaded so far
    const match = availableProviders.find(
      (p) => p.provider === selectedProvider.provider && p.keyId === selectedProvider.keyId,
    );
    if (!match) {
      // Saved provider no longer exists — fall back to Ollama
      setSelectedProvider({ provider: "ollama", keyId: null });
      setSelectedModel(null);
    } else if (match.label !== selectedProvider.label || match.model !== selectedProvider.model) {
      // Enrich with label/model from API (localStorage only stores provider+keyId)
      setSelectedProvider(match);
    }
  }, [availableProviders]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close model picker on outside click
  useEffect(() => {
    if (!modelPickerOpen) return;
    const handleOutside = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [modelPickerOpen]);

  // Fetch models when picker opens or picker-provider changes
  const fetchModelsForPicker = useCallback(async (providerEntry) => {
    if (!providerEntry) return;
    setModelListLoading(true);
    setModelList([]);
    setModelListError("");
    setModelFilter("");
    try {
      let result;
      if (providerEntry.provider === "ollama") {
        result = await searchApi.listOllamaModels();
      } else if (providerEntry.keyId) {
        result = await apiKeysApi.listModels(providerEntry.keyId);
      } else {
        setModelListLoading(false);
        return;
      }
      setModelList(result.models || []);
      if (!result.models?.length && result.error) {
        setModelListError(result.error);
      }
    } catch {
      setModelList([]);
    } finally {
      setModelListLoading(false);
    }
  }, []);

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

  // Model picker: open popover and load models for current provider
  const handleOpenModelPicker = useCallback(() => {
    setModelPickerOpen(true);
    setPickerProvider(selectedProvider);
    fetchModelsForPicker(selectedProvider);
  }, [selectedProvider, fetchModelsForPicker]);

  // Model picker: switch provider inside the popover
  const handlePickerProviderSelect = useCallback((providerEntry) => {
    setPickerProvider(providerEntry);
    fetchModelsForPicker(providerEntry);
    // Immediately switch the active provider so the next chat uses it,
    // and clear stale model (model IDs are provider-specific).
    if (providerEntry.keyId !== selectedProvider.keyId || providerEntry.provider !== selectedProvider.provider) {
      setSelectedProvider(providerEntry);
      setSelectedModel(null);
    }
  }, [fetchModelsForPicker, selectedProvider]);

  // Model picker: select a model and close
  const handleModelSelect = useCallback((modelEntry, providerEntry) => {
    // Switch provider if different
    if (providerEntry && (providerEntry.keyId !== selectedProvider.keyId || providerEntry.provider !== selectedProvider.provider)) {
      setSelectedProvider(providerEntry);
    }
    setSelectedModel(modelEntry.id);
    setModelPickerOpen(false);
  }, [selectedProvider]);

  // Get display model name for the trigger button
  const displayModelName = selectedModel || selectedProvider.model || "";

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
    // Reset textarea height after clearing
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
      .map((m) => ({
        role: m.role,
        content: m.versions && m.activeVersionIndex != null
          ? m.versions[m.activeVersionIndex]?.content || m.content
          : m.content,
      }));

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
        selectedModel || null,
        strictContext,
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
              content: last.content || err.message || "An error occurred. Please try again.",
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
  }, [input, isStreaming, scope, currentDocument, deepThink, documents, loadDocument, categoryFilterEnabled, selectedCategoryId, selectedProvider, selectedModel, useSelection, editorSelection, history, messages]);

  // --- Resend: re-submit the last user prompt and version the assistant response ---
  const handleResend = useCallback(async () => {
    if (isStreaming) return;

    // Find the last user message and the corresponding assistant message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user" && !messages[i].isAction) { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const question = messages[lastUserIdx].content;

    // Find the assistant message right after the last user message
    const assistantIdx = messages.findIndex((m, i) => i > lastUserIdx && m.role === "assistant" && !m.isAction);
    if (assistantIdx === -1) return;

    setIsStreaming(true);
    const startTime = Date.now();

    // Snapshot current assistant response into versions array
    setMessages((prev) => {
      const updated = [...prev];
      const aMsg = { ...updated[assistantIdx] };
      if (!aMsg.versions) {
        // First resend — initialize versions with the original as version 0
        const groupId = crypto.randomUUID();
        aMsg.versions = [{ content: aMsg.content, duration: aMsg.duration, serverMetrics: aMsg.serverMetrics }];
        aMsg.responseGroupId = groupId;
      }
      aMsg.content = "";
      aMsg.streaming = true;
      aMsg.startTime = startTime;
      aMsg.duration = undefined;
      aMsg.serverMetrics = undefined;
      aMsg.activeVersionIndex = aMsg.versions.length; // will point to the new version once added
      updated[assistantIdx] = aMsg;
      return updated;
    });

    const controller = new AbortController();
    abortRef.current = controller;

    const documentId = scope === SCOPE_CURRENT && currentDocument ? currentDocument.id : null;
    const useDeepThink = deepThink && scope === SCOPE_CURRENT && Boolean(currentDocument);
    const categoryId = categoryFilterEnabled && scope === SCOPE_ALL && selectedCategoryId ? selectedCategoryId : null;

    // Build conversation history from prior completed messages up to (but not including) the resent pair
    const priorMessages = messages.slice(0, lastUserIdx)
      .filter((m) => !m.streaming && !m.isAction && m.content)
      .map((m) => ({ role: m.role, content: m.versions ? m.versions[m.activeVersionIndex ?? m.versions.length - 1]?.content || m.content : m.content }));

    try {
      await searchApi.askQuestion(
        question,
        documentId,
        (token) => {
          if (token && typeof token === "object" && token.type === "metrics") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[assistantIdx];
              if (last?.role === "assistant") {
                updated[assistantIdx] = { ...last, serverMetrics: token.data };
              }
              return updated;
            });
            return;
          }
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[assistantIdx];
            if (last?.role === "assistant") {
              updated[assistantIdx] = { ...last, content: last.content + token };
            }
            return updated;
          });
        },
        controller.signal,
        useDeepThink,
        priorMessages,
        categoryId,
        selectedProvider.provider !== "ollama" ? selectedProvider.provider : null,
        null, // no selection context for resend
        selectedProvider.keyId || null,
        selectedModel || null,
        strictContext,
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        const endTime = Date.now();
        setMessages((prev) => {
          const updated = [...prev];
          const aMsg = { ...updated[assistantIdx] };
          aMsg.content = aMsg.content || err.message || "An error occurred. Please try again.";
          aMsg.streaming = false;
          aMsg.duration = endTime - (aMsg.startTime || endTime);
          updated[assistantIdx] = aMsg;
          return updated;
        });
      }
    } finally {
      const endTime = Date.now();
      setMessages((prev) => {
        const updated = [...prev];
        const aMsg = { ...updated[assistantIdx] };
        const duration = endTime - (aMsg.startTime || endTime);
        aMsg.streaming = false;
        aMsg.duration = duration;

        // Push new version into versions array
        if (aMsg.versions) {
          aMsg.versions = [...aMsg.versions, { content: aMsg.content, duration, serverMetrics: aMsg.serverMetrics }];
          aMsg.activeVersionIndex = aMsg.versions.length - 1;
        }

        // Persist new assistant response version (fire-and-forget)
        const convId = history.activeConversationId;
        if (convId && aMsg.content) {
          const metaObj = {};
          if (duration) metaObj.duration = duration;
          if (aMsg.serverMetrics) metaObj.serverMetrics = aMsg.serverMetrics;
          if (aMsg.responseGroupId) {
            metaObj.responseGroupId = aMsg.responseGroupId;
            metaObj.responseVersion = aMsg.versions ? aMsg.versions.length - 1 : 0;
          }
          const metaJson = Object.keys(metaObj).length ? JSON.stringify(metaObj) : null;
          history.saveMessage(convId, "assistant", aMsg.content, metaJson);
        }

        updated[assistantIdx] = aMsg;
        return updated;
      });
      setIsStreaming(false);
    }
  }, [isStreaming, messages, scope, currentDocument, deepThink, categoryFilterEnabled, selectedCategoryId, selectedProvider, selectedModel, history]);

  // --- Edit: activate inline edit mode on last user message ---
  const handleEdit = useCallback((msgIndex) => {
    if (isStreaming) return;
    setEditingMessageIndex(msgIndex);
    setEditInput(messages[msgIndex]?.content || "");
  }, [isStreaming, messages]);

  // --- Edit submit: replace user message in-place, then resend ---
  const pendingResendRef = useRef(false);
  const handleEditSubmit = useCallback(async () => {
    if (editingMessageIndex === null || isStreaming) return;
    const newContent = editInput.trim();
    if (!newContent) return;

    // Replace user message content in-place
    setMessages((prev) => {
      const updated = [...prev];
      updated[editingMessageIndex] = { ...updated[editingMessageIndex], content: newContent };
      return updated;
    });

    // Persist edited user message as audit trail
    const convId = history.activeConversationId;
    if (convId) {
      history.saveMessage(convId, "user", newContent, JSON.stringify({ editVersion: Date.now() }));
    }

    setEditingMessageIndex(null);
    setEditInput("");
    pendingResendRef.current = true;
  }, [editingMessageIndex, editInput, isStreaming, history]);

  // Trigger resend after edit state has been committed
  useEffect(() => {
    if (pendingResendRef.current && !isStreaming && editingMessageIndex === null) {
      pendingResendRef.current = false;
      handleResend();
    }
  }, [messages, isStreaming, editingMessageIndex, handleResend]);

  // --- Version change: cycle through assistant response versions ---
  const handleVersionChange = useCallback((msgIndex, direction) => {
    setMessages((prev) => {
      const updated = [...prev];
      const msg = { ...updated[msgIndex] };
      if (!msg.versions || msg.versions.length <= 1) return prev;

      const current = msg.activeVersionIndex ?? msg.versions.length - 1;
      const next = Math.max(0, Math.min(msg.versions.length - 1, current + direction));
      if (next === current) return prev;

      const version = msg.versions[next];
      msg.activeVersionIndex = next;
      msg.content = version.content;
      msg.duration = version.duration;
      msg.serverMetrics = version.serverMetrics;
      updated[msgIndex] = msg;
      return updated;
    });
  }, []);

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
    setEditingMessageIndex(null);
    setEditInput("");
    history.clearActive();
    setShowHistory(false);
  };

  const handleHistorySelect = async (conversationId) => {
    const detail = await history.loadConversation(conversationId);
    if (detail) {
      // Parse metadata and reconstruct assistant response versions
      const rawMessages = (detail.messages || []).map((m) => {
        let meta = {};
        if (m.metadata_json) { try { meta = JSON.parse(m.metadata_json); } catch { /* ignore */ } }
        return { role: m.role, content: m.content, streaming: false, ...meta };
      });

      // Group assistant messages by responseGroupId into versions
      const groupedMessages = [];
      const seenGroups = new Map(); // responseGroupId → index in groupedMessages

      for (const m of rawMessages) {
        // Skip user edit audit-trail duplicates (keep latest only via metadata)
        if (m.role === "user" && m.editVersion) {
          // Replace the most recent user message in output
          for (let i = groupedMessages.length - 1; i >= 0; i--) {
            if (groupedMessages[i].role === "user") {
              groupedMessages[i] = { role: m.role, content: m.content, streaming: false };
              break;
            }
          }
          continue;
        }

        if (m.role === "assistant" && m.responseGroupId) {
          const gid = m.responseGroupId;
          if (seenGroups.has(gid)) {
            // Add as another version to the existing grouped message
            const existingIdx = seenGroups.get(gid);
            const existing = groupedMessages[existingIdx];
            if (!existing.versions) {
              existing.versions = [{ content: existing.content, duration: existing.duration, serverMetrics: existing.serverMetrics }];
            }
            existing.versions.push({ content: m.content, duration: m.duration, serverMetrics: m.serverMetrics });
            existing.activeVersionIndex = existing.versions.length - 1;
            existing.content = m.content;
            existing.duration = m.duration;
            existing.serverMetrics = m.serverMetrics;
            existing.responseGroupId = gid;
          } else {
            seenGroups.set(gid, groupedMessages.length);
            groupedMessages.push({ role: m.role, content: m.content, streaming: false, duration: m.duration, serverMetrics: m.serverMetrics, responseGroupId: gid });
          }
        } else {
          groupedMessages.push({ role: m.role, content: m.content, streaming: false, duration: m.duration, serverMetrics: m.serverMetrics });
        }
      }

      setMessages(groupedMessages);
      if (detail.scope) setScope(detail.scope);
        if (detail.provider) {
          const match = availableProviders.find((p) => p.provider === detail.provider) ||
            { provider: detail.provider, keyId: null };
          setSelectedProvider(match);
        }
    } else {
      // Conversation no longer exists — clear stale active state
      history.clearActive();
      setMessages([]);
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

        {/* Provider & Model picker */}
        <div className="chat-model-picker" ref={modelPickerRef}>
          <button
            type="button"
            className="chat-model-picker-trigger"
            onClick={handleOpenModelPicker}
            title="Change provider or model"
          >
            <i className={`bi ${PROVIDER_LABELS[selectedProvider.provider]?.icon || "bi-cpu"}`} />
            <span className="picker-label">{selectedProvider.label || PROVIDER_LABELS[selectedProvider.provider]?.name || selectedProvider.provider}</span>
            {displayModelName && <span className="picker-model">{displayModelName}</span>}
            <i className={`bi bi-chevron-${modelPickerOpen ? "up" : "down"} picker-chevron`} />
          </button>

          {modelPickerOpen && (
            <div className="chat-model-popover" onKeyDown={(e) => e.key === "Escape" && setModelPickerOpen(false)}>
              <div className="model-picker-providers">
                {availableProviders.map((p) => {
                  const key = p.keyId ? `key:${p.keyId}` : p.provider;
                  const isActive = pickerProvider && (pickerProvider.keyId === p.keyId && pickerProvider.provider === p.provider);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`provider-item${isActive ? " active" : ""}`}
                      onClick={() => handlePickerProviderSelect(p)}
                    >
                      <i className={`bi ${PROVIDER_LABELS[p.provider]?.icon || "bi-key"}`} />
                      <span className="provider-item-label">{p.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="model-picker-models">
                {modelList.length > 6 && (
                  <input
                    type="text"
                    className="model-filter-input"
                    placeholder="Filter models…"
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    autoFocus
                  />
                )}
                <div className="model-list-scroll">
                  {modelListLoading ? (
                    <div className="model-list-loading">
                      <i className="bi bi-arrow-clockwise spin" /> Loading models…
                    </div>
                  ) : modelList.length === 0 ? (
                    <div className="model-list-empty">
                      {modelListError
                        ? <><i className="bi bi-exclamation-triangle me-1" />Failed to load models: {modelListError}</>
                        : "No models available"}
                    </div>
                  ) : (
                    modelList
                      .filter((m) => !modelFilter || m.id.toLowerCase().includes(modelFilter.toLowerCase()) || (m.name && m.name.toLowerCase().includes(modelFilter.toLowerCase())))
                      .map((m) => {
                        const isSelected = pickerProvider &&
                          pickerProvider.provider === selectedProvider.provider &&
                          pickerProvider.keyId === selectedProvider.keyId &&
                          (selectedModel === m.id || (!selectedModel && selectedProvider.model === m.id));
                        // Build a compact metadata string
                        const meta = [];
                        if (m.context_window) {
                          meta.push(m.context_window >= 1000 ? `${Math.round(m.context_window / 1000)}K` : `${m.context_window}`);
                        }
                        if (m.parameter_size) meta.push(m.parameter_size);
                        if (m.size) meta.push(m.size);
                        if (m.input_price != null) {
                          meta.push(`$${m.input_price.toFixed(2)}${m.output_price != null ? `/$${m.output_price.toFixed(2)}` : ""}`);
                        }
                        if (m.tier) meta.push(m.tier);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`model-row${isSelected ? " selected" : ""}`}
                            onClick={() => handleModelSelect(m, pickerProvider)}
                            title={m.description || m.id}
                          >
                            {isSelected && <i className="bi bi-check-lg model-check" />}
                            <span className="model-name">{m.id}</span>
                            {meta.length > 0 && <span className="model-meta">{meta.join(" · ")}</span>}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

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

        {/* Strict Context toggle — document-only answers, no general knowledge */}
        <div className="chat-strict-context">
          <label className="strict-context-label" htmlFor="strict-context-toggle">
            <i className="bi bi-lock" />
            Document Only
            <span className="strict-context-hint">No general knowledge</span>
          </label>
          <div
            className={`strict-context-toggle${strictContext ? " on" : ""}`}
            id="strict-context-toggle"
            role="switch"
            aria-checked={strictContext}
            tabIndex={0}
            onClick={() => setStrictContext((v) => !v)}
            onKeyDown={(e) => e.key === "Enter" || e.key === " " ? setStrictContext((v) => !v) : null}
          />
        </div>

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
            (() => {
              // Compute last user message index for resend/edit icon placement
              let lastUserMsgIdx = -1;
              for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === "user" && !messages[i].isAction) { lastUserMsgIdx = i; break; }
              }
              return messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}-message`}>
                  {/* User message: inline edit mode or static bubble */}
                  {msg.role === "user" && editingMessageIndex === idx ? (
                    <div className="message-edit-mode">
                      <textarea
                        ref={editTextareaRef}
                        className="edit-textarea"
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                          if (e.key === "Escape") { setEditingMessageIndex(null); setEditInput(""); }
                        }}
                        rows={Math.min(6, Math.max(1, editInput.split("\n").length))}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button type="button" className="action-btn confirm-yes" title="Save & resend" onClick={handleEditSubmit}>
                          <i className="bi bi-check-lg" />
                        </button>
                        <button type="button" className="action-btn confirm-no" title="Cancel" onClick={() => { setEditingMessageIndex(null); setEditInput(""); }}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`message-bubble${msg.streaming ? " streaming-cursor" : ""}`}>
                        {msg.role === "assistant" ? (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: msg.streaming
                                ? md.render(msg.content || "")
                                : injectDocumentLinks(md.render(msg.content || ""), documents),
                            }}
                          />
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: md.render(msg.content || "") }} />
                        )}
                      </div>
                      {/* Resend + Edit icons on the last user message only */}
                      {msg.role === "user" && idx === lastUserMsgIdx && !isStreaming && !msg.isAction && (
                        <div className="user-message-actions">
                          <button type="button" className="action-btn resend-btn" title="Resend" onClick={handleResend}>
                            <i className="bi bi-arrow-clockwise" />
                          </button>
                          <button type="button" className="action-btn edit-btn" title="Edit" onClick={() => handleEdit(idx)}>
                            <i className="bi bi-pencil-square" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {/* Version navigation for assistant messages with multiple versions */}
                  {msg.role === "assistant" && msg.versions?.length > 1 && !msg.streaming && (
                    <div className="message-version-nav">
                      <button
                        type="button"
                        className="version-nav-btn"
                        disabled={(msg.activeVersionIndex ?? msg.versions.length - 1) === 0}
                        onClick={() => handleVersionChange(idx, -1)}
                        title="Previous version"
                      >
                        <i className="bi bi-chevron-left" />
                      </button>
                      <span className="version-counter">
                        {(msg.activeVersionIndex ?? msg.versions.length - 1) + 1} / {msg.versions.length}
                      </span>
                      <button
                        type="button"
                        className="version-nav-btn"
                        disabled={(msg.activeVersionIndex ?? msg.versions.length - 1) === msg.versions.length - 1}
                        onClick={() => handleVersionChange(idx, 1)}
                        title="Next version"
                      >
                        <i className="bi bi-chevron-right" />
                      </button>
                    </div>
                  )}
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
              ));
            })()
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
                  ? `Ask about "${currentDocument.name}"… (Shift+Enter for new line)`
                  : "Ask about your documents… (Shift+Enter for new line)"
              }
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize textarea to fit content
                const ta = e.target;
                ta.style.height = "auto";
                ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
              }}
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

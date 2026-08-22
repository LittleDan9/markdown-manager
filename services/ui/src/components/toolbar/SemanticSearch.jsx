import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { searchApi } from "@/api/searchApi";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";
import { useAuth } from "@/providers/AuthProvider.jsx";

const DEBOUNCE_MS = 300;
const DEEP_DEBOUNCE_MS = 800;

const DEEP_SEARCH_PHRASES = [
  "Expanding query…",
  "Searching deeper…",
  "Reranking results…",
  "Analyzing relevance…",
];

function SemanticSearch() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { searchMode: userSearchMode } = useAuth();
  const [deepMode, setDeepMode] = useState(userSearchMode === "deep");
  const [loadingPhrase, setLoadingPhrase] = useState("");
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const phraseRef = useRef(null);

  const { loadDocument } = useDocumentContext();

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
        if (!query) setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query]);

  const performSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsLoading(true);
    if (deepMode) {
      let idx = 0;
      setLoadingPhrase(DEEP_SEARCH_PHRASES[0]);
      phraseRef.current = setInterval(() => {
        idx = (idx + 1) % DEEP_SEARCH_PHRASES.length;
        setLoadingPhrase(DEEP_SEARCH_PHRASES[idx]);
      }, 1500);
    }
    try {
      const data = deepMode
        ? await searchApi.deepSearch(q, 10)
        : await searchApi.semanticSearch(q, 10);
      setResults(data);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
      clearInterval(phraseRef.current);
    }
  }, [deepMode]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    const delay = deepMode ? DEEP_DEBOUNCE_MS : DEBOUNCE_MS;
    debounceRef.current = setTimeout(() => performSearch(val), delay);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setExpanded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") handleClear();
  };

  const handleResultClick = (result) => {
    if (result.document?.id) {
      loadDocument(result.document.id);
    }
    handleClear();
  };

  const formatPath = (doc) => {
    if (doc.folder_path && doc.folder_path !== "/") return doc.folder_path;
    if (doc.category_name) return `/${doc.category_name}`;
    return "/";
  };

  return (
    <div className="semantic-search-wrapper" ref={wrapperRef}>
      <div className={`semantic-search-input-group${expanded ? " expanded" : ""}`}>
        <button
          className="search-icon-btn"
          onClick={() => setExpanded(true)}
          title="Search documents"
          type="button"
          aria-label="Open document search"
        >
          <i className="bi bi-search" />
        </button>

        {expanded && (
          <>
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              placeholder={deepMode ? "Deep search…" : "Search your documents…"}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              aria-label="Document search query"
            />
            <button
              className={`search-deep-btn${deepMode ? " active" : ""}`}
              onClick={() => setDeepMode((d) => !d)}
              title={deepMode ? "Switch to quick search" : "Switch to deep search (slower, better recall)"}
              type="button"
              aria-label="Toggle deep search"
            >
              <i className={deepMode ? "bi bi-lightning-charge-fill" : "bi bi-lightning-charge"} />
            </button>
            {query && (
              <button
                className="search-clear-btn"
                onClick={handleClear}
                title="Clear"
                type="button"
                aria-label="Clear search"
              >
                <i className="bi bi-x" />
              </button>
            )}
          </>
        )}
      </div>

      {showResults && expanded && (
        <div className="semantic-search-results" role="listbox" aria-label="Search results">
          {isLoading ? (
            <div className="search-loading-state">
              <i className="bi bi-arrow-repeat" />
              {deepMode ? loadingPhrase : "Searching…"}
            </div>
          ) : results.length === 0 ? (
            <div className="search-empty-state">
              <i className="bi bi-file-earmark-x" />
              No matching documents
              {!deepMode && (
                <button
                  className="try-deep-search-btn"
                  onClick={() => { setDeepMode(true); performSearch(query); }}
                  type="button"
                >
                  Try deep search <i className="bi bi-lightning-charge" />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="search-results-header">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              {results.map(({ document: doc, score, explanation }, idx) => (
                <div
                  key={doc.id}
                  className="search-result-item"
                  role="option"
                  tabIndex={0}
                  onClick={() => handleResultClick({ document: doc, score })}
                  onKeyDown={(e) => e.key === "Enter" && handleResultClick({ document: doc, score })}
                >
                  <span className="result-icon">
                    <i className="bi bi-file-earmark-text" />
                  </span>
                  <div className="result-info">
                    <div className="result-name" title={doc.name}>
                      {doc.name}
                      {idx === 0 && score >= 0.6 && (
                        <span className="best-match-badge">Best match</span>
                      )}
                    </div>
                    <div className="result-path" title={formatPath(doc)}>
                      {formatPath(doc)}
                    </div>
                    {explanation && (
                      <div className="result-explanation">{explanation}</div>
                    )}
                  </div>
                  <div className="result-score">
                    <div className="score-bar">
                      <div
                        className={`score-fill${score >= 0.7 ? " high" : score >= 0.4 ? " medium" : " low"}`}
                        style={{ width: `${Math.round(score * 100)}%` }}
                      />
                    </div>
                    <span className="score-label">{Math.round(score * 100)}%</span>
                  </div>
                </div>
              ))}
              {!deepMode && results.length < 2 && results.length > 0 && (
                <div className="search-empty-state" style={{ paddingTop: "10px" }}>
                  <button
                    className="try-deep-search-btn"
                    onClick={() => { setDeepMode(true); performSearch(query); }}
                    type="button"
                  >
                    Try deep search for more results <i className="bi bi-lightning-charge" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

SemanticSearch.propTypes = {};

export default SemanticSearch;

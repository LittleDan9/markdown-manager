import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { searchApi } from "@/api/searchApi";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";

const DEBOUNCE_MS = 300;

function SemanticSearch() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  const { openDocument } = useDocumentContext();

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
    try {
      const data = await searchApi.semanticSearch(q, 10);
      setResults(data);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), DEBOUNCE_MS);
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
    if (openDocument) {
      openDocument(result.document);
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
              placeholder="Search your documents…"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              aria-label="Document search query"
            />
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
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="search-empty-state">
              <i className="bi bi-file-earmark-x" />
              No matching documents
            </div>
          ) : (
            <>
              <div className="search-results-header">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              {results.map(({ document: doc, score }) => (
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
                    </div>
                    <div className="result-path" title={formatPath(doc)}>
                      {formatPath(doc)}
                    </div>
                  </div>
                  <div className="result-score">
                    <div className="score-bar">
                      <div
                        className="score-fill"
                        style={{ width: `${Math.round(score * 100)}%` }}
                      />
                    </div>
                    <span className="score-label">{Math.round(score * 100)}%</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

SemanticSearch.propTypes = {};

export default SemanticSearch;

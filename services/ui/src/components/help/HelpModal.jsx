import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Modal, Nav, Form, Spinner } from 'react-bootstrap';
import MarkdownIt from 'markdown-it';
import helpApi from '@/api/helpApi';

// Safe markdown renderer (html disabled)
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

// Icon mapping for sidebar topics
const TOPIC_ICONS = {
  'getting-started': 'bi-rocket-takeoff',
  'editor-and-formatting': 'bi-pencil-square',
  'file-management': 'bi-folder2-open',
  'ai-chat': 'bi-chat-dots',
  'sharing-and-collaboration': 'bi-people',
  'github-integration': 'bi-github',
  'settings': 'bi-gear',
  'search': 'bi-search',
  'keyboard-shortcuts': 'bi-keyboard',
};

function HelpModal({ show, onHide }) {
  const [topics, setTopics] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef(null);

  // Fetch topic list on open
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    helpApi.listTopics().then((data) => {
      if (cancelled) return;
      setTopics(data);
      // Auto-select first topic if nothing selected
      if (data.length > 0 && !activeSlug) {
        setActiveSlug(data[0].slug);
      }
    }).catch((err) => {
      console.error('Failed to load help topics:', err);
    });
    return () => { cancelled = true; };
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch content when active topic changes
  useEffect(() => {
    if (!activeSlug || !show) return;
    let cancelled = false;
    setLoading(true);
    helpApi.getTopic(activeSlug).then((data) => {
      if (cancelled) return;
      setContent(data.content);
      setLoading(false);
      // Scroll content to top
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }).catch((err) => {
      if (cancelled) return;
      console.error('Failed to load help topic:', err);
      setContent('');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeSlug, show]);

  // Filter topics by search query
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return topics;
    const q = searchQuery.toLowerCase();
    return topics.filter((t) => t.title.toLowerCase().includes(q));
  }, [topics, searchQuery]);

  // Render markdown to HTML
  const renderedHTML = useMemo(() => {
    if (!content) return '';
    return md.render(content);
  }, [content]);

  const handleTopicClick = useCallback((slug) => {
    setActiveSlug(slug);
  }, []);

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onHide();
  }, [onHide]);

  // Reset state when modal hides
  useEffect(() => {
    if (!show) {
      setSearchQuery('');
    }
  }, [show]);

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      scrollable
      className="help-modal"
      data-bs-theme={document.documentElement.getAttribute('data-bs-theme')}
    >
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title>
          <i className="bi bi-book me-2" />User Guide
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 d-flex help-modal-body">
        {/* Sidebar */}
        <div className="help-sidebar">
          <div className="help-sidebar-search">
            <Form.Control
              size="sm"
              type="text"
              placeholder="Filter topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <Nav variant="pills" className="flex-column help-sidebar-nav">
            {filteredTopics.map((topic) => (
              <Nav.Item key={topic.slug}>
                <Nav.Link
                  active={topic.slug === activeSlug}
                  onClick={() => handleTopicClick(topic.slug)}
                  className="help-sidebar-link"
                >
                  <i className={`bi ${TOPIC_ICONS[topic.slug] || 'bi-file-text'} me-2`} />
                  {topic.title}
                </Nav.Link>
              </Nav.Item>
            ))}
            {filteredTopics.length === 0 && (
              <div className="text-muted small px-3 py-2">No topics match your search.</div>
            )}
          </Nav>
        </div>

        {/* Content */}
        <div className="help-content" ref={contentRef}>
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100">
              <Spinner animation="border" size="sm" className="me-2" />
              Loading...
            </div>
          ) : renderedHTML ? (
            <div
              className="help-content-body"
              dangerouslySetInnerHTML={{ __html: renderedHTML }}
            />
          ) : (
            <div className="text-muted d-flex justify-content-center align-items-center h-100">
              Select a topic from the sidebar to get started.
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

HelpModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
};

export default HelpModal;

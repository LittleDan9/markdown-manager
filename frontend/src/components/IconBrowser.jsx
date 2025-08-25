import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Container, Row, Col, Card, Form, Badge, Button, Alert, InputGroup, Collapse } from 'react-bootstrap';
import { useLogger } from '../providers/LoggerProvider';
import { IconService } from '@/services/utilities';

const ITEMS_PER_ROW = 4;
const INITIAL_LOAD_SIZE = 24; // 6 rows
const LOAD_MORE_SIZE = 16;    // 4 more rows per “page”

const DIAGRAM_TYPES = {
  architecture: {
    label: 'Architecture Diagram',
    description: 'architecture-beta diagrams'
  },
  flowchart: {
    label: 'Flowchart',
    description: 'flowchart diagrams with icon shapes'
  }
};

export default function IconBrowser() {
  const log = useLogger('IconBrowser');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIconPack, setSelectedIconPack] = useState('all');
  const [selectedDiagramType, setSelectedDiagramType] = useState(
    () => localStorage.getItem('iconBrowser_diagramType') || 'architecture'
  );
  const [availableIconPacks, setAvailableIconPacks] = useState([]);
  const [availableCategories, setAvailableCategories] = useState(['all']);
  const [totalIconCount, setTotalIconCount] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleEnd, setVisibleEnd] = useState(INITIAL_LOAD_SIZE);
  const [copied, setCopied] = useState('');

  // Add error resilience state
  const [errorCount, setErrorCount] = useState(0);
  const [lastErrorTime, setLastErrorTime] = useState(0);
  const [isRetryDisabled, setIsRetryDisabled] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

  // Ref to track if we're in the middle of a scroll-triggered load
  const isScrollLoadingRef = useRef(false);

  // Update retry countdown timer
  useEffect(() => {
    if (!isRetryDisabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastErrorTime;
      const minRetryDelay = Math.min(5000 * Math.pow(2, errorCount), 30000);
      const remaining = Math.max(0, minRetryDelay - elapsed);

      if (remaining <= 0) {
        setIsRetryDisabled(false);
        setRetryCountdown(0);
      } else {
        setRetryCountdown(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRetryDisabled, lastErrorTime, errorCount]);

  // Retry function for error handling with exponential backoff
  const retryLoading = useCallback(async () => {
    const now = Date.now();

    // Prevent rapid retries - use exponential backoff
    const minRetryDelay = Math.min(5000 * Math.pow(2, errorCount), 30000); // Max 30 seconds
    if (now - lastErrorTime < minRetryDelay) {
      setIsRetryDisabled(true);
      setTimeout(() => setIsRetryDisabled(false), minRetryDelay - (now - lastErrorTime));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsRetryDisabled(false);

      await IconService.loadAllIconPacks();

      const packs = IconService.getAvailableIconPacks();
      const categories = IconService.getAvailableCategories();
      const totalCount = IconService.getTotalIconCount();

      setAvailableIconPacks(packs);
      setAvailableCategories(categories);
      setTotalIconCount(totalCount);

      // Reset error count on success
      setErrorCount(0);
      setLastErrorTime(0);

    } catch (e) {
      log.error('Failed to load icons', e);
      setError(`Failed to load icons: ${e.message}. Check console for details.`);

      // Track error for backoff
      setErrorCount(prev => prev + 1);
      setLastErrorTime(now);
    } finally {
      setLoading(false);
    }
  }, [log, errorCount, lastErrorTime]);

  // Update categories when icon pack changes
  useEffect(() => {
    if (IconService.isLoaded()) {
      const newCategories = IconService.getAvailableCategoriesForPack(selectedIconPack);
      setAvailableCategories(newCategories);

      // Reset category to 'all' if current category is not available in the new pack
      if (selectedCategory !== 'all' && !newCategories.includes(selectedCategory)) {
        setSelectedCategory('all');
      }

      // Reset error state when user changes pack - give them a fresh chance
      if (errorCount > 0) {
        setErrorCount(0);
        setLastErrorTime(0);
      }
    }
  }, [selectedIconPack, selectedCategory, errorCount]);

  // One-time load with its own error handling - now lazy and efficient
  useEffect(() => {
    const initialLoad = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if IconService is already loaded to avoid redundant API calls
        if (IconService.isLoaded()) {
          // Use already loaded data
          const packs = IconService.getAvailableIconPacks();
          const categories = IconService.getAvailableCategories();
          const totalCount = IconService.getTotalIconCount();

          setAvailableIconPacks(packs);
          setAvailableCategories(categories);
          setTotalIconCount(totalCount);
        } else {
          // Load icon packs only if not already loaded
          await IconService.loadAllIconPacks();

          const packs = IconService.getAvailableIconPacks();
          const categories = IconService.getAvailableCategories();
          const totalCount = IconService.getTotalIconCount();

          setAvailableIconPacks(packs);
          setAvailableCategories(categories);
          setTotalIconCount(totalCount);
        }

      } catch (e) {
        log.error('Failed to load icons on initial load', e);
        setError(`Failed to load icons: ${e.message}. Check console for details.`);
        setErrorCount(1);
        setLastErrorTime(Date.now());
      } finally {
        setLoading(false);
      }
    };

    initialLoad();
  }, []); // No dependencies to prevent loops

  // Persist diagram type
  useEffect(() => {
    localStorage.setItem('iconBrowser_diagramType', selectedDiagramType);
  }, [selectedDiagramType]);

  // Compute filtered icons via memo with async handling
  const [filteredIcons, setFilteredIcons] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Handle search when filters change or when service becomes loaded
  useEffect(() => {
    const searchIcons = async () => {
      // Early return if service not loaded
      if (!IconService.isLoaded()) {
        setFilteredIcons([]);
        return;
      }

      // Skip search if we're in an error state with high error count
      if (errorCount >= 3) {
        setFilteredIcons([]);
        return;
      }

      try {
        setSearchLoading(true);
        setError(null); // Clear any previous errors only when we can actually search

        const list = await IconService.searchIcons(
          searchTerm,
          selectedCategory,
          selectedIconPack
        );

        const iconsWithUsage = list.map(icon => ({
          ...icon,
          usage: IconService.generateUsageExample(icon.prefix, icon.key, selectedDiagramType)
        }));

        setFilteredIcons(iconsWithUsage);

        // Reset error count on successful search
        setErrorCount(0);
        setLastErrorTime(0);

      } catch (error) {
        console.error('Search failed:', error);
        log.error('[IconBrowser] Search failed:', error);
        setFilteredIcons([]);

        // Increment error count
        const newErrorCount = errorCount + 1;
        setErrorCount(newErrorCount);
        setLastErrorTime(Date.now());

        // Set user-friendly error message
        let errorMessage = 'Failed to search icons. ';
        if (error.response?.status === 422) {
          errorMessage += 'Invalid search parameters.';
        } else if (error.response?.status >= 500) {
          errorMessage += 'Server error. ';
          if (newErrorCount >= 3) {
            errorMessage += 'Multiple failures detected - search disabled temporarily.';
          } else {
            errorMessage += 'Please try again.';
          }
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          errorMessage += 'Network connection issue. Check your connection.';
        } else {
          errorMessage += error.message || 'Unknown error occurred.';
        }
        setError(errorMessage);
      } finally {
        setSearchLoading(false);
      }
    };

    // Add delay and abort controller to prevent rapid re-searches
    const timeoutId = setTimeout(searchIcons, 150);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedCategory, selectedIconPack, selectedDiagramType, log]); // Removed 'loading' and 'errorCount' to prevent loops

  // Remove the separate initial search effect since it's handled above

  // Reset visible window when filters change
  useEffect(() => {
    // Only reset when we have actual user filter changes and icons are loaded
    if (filteredIcons.length > 0 && !isScrollLoadingRef.current) {
      setVisibleEnd(INITIAL_LOAD_SIZE);
    }
    // Clear the scroll loading flag
    isScrollLoadingRef.current = false;
  }, [searchTerm, selectedCategory, selectedIconPack, selectedDiagramType]); // Track actual filter changes, not filteredIcons

  const visibleIcons = useMemo(() => {
    return filteredIcons.slice(0, Math.min(visibleEnd, filteredIcons.length));
  }, [filteredIcons, visibleEnd]);

  // Simple “infinite” scroll that also works inside modals
  useEffect(() => {
    const modalBody = document.querySelector('.modal-body');
    const target = modalBody || window;

    const onScroll = () => {
      const sc = modalBody || document.documentElement;
      const { scrollTop, scrollHeight, clientHeight } = sc;
      if (scrollHeight - scrollTop <= clientHeight + 400 && visibleEnd < filteredIcons.length) {
        // Mark that we're loading more to prevent reset during scroll
        isScrollLoadingRef.current = true;
        setVisibleEnd(v => Math.min(v + LOAD_MORE_SIZE, filteredIcons.length));
      }
    };

    target.addEventListener('scroll', onScroll);
    return () => target.removeEventListener('scroll', onScroll);
  }, [filteredIcons.length, visibleEnd]);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // no-op
    }
  }, []);

  // Single, robust SVG renderer (DRY)
  const renderSVG = useCallback((iconData) => {
    if (!iconData || !iconData.body) {
      return (
        <div className="d-flex align-items-center justify-content-center border rounded bg-body-secondary"
             style={{ width: 48, height: 48 }}>
          <small className="text-muted">?</small>
        </div>
      );
    }
    const viewBox = iconData.viewBox || '0 0 24 24';
    return (
      <svg
        width="48"
        height="48"
        viewBox={viewBox}
        className="border rounded bg-body-secondary"
        style={{ padding: 4 }}
        dangerouslySetInnerHTML={{ __html: iconData.body }}
      />
    );
  }, []);

  if (loading) {
    return (
      <Container className="p-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading icons…</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="p-4">
        <Alert variant="danger">
          <Alert.Heading>Error Loading Icons</Alert.Heading>
          <p>{error}</p>
          <div className="d-flex gap-2">
            <Button
              variant="outline-danger"
              onClick={retryLoading}
              disabled={isRetryDisabled}
            >
              {isRetryDisabled ? 'Please wait...' : 'Retry'}
            </Button>
            {errorCount >= 3 && (
              <Button
                variant="outline-secondary"
                onClick={() => {
                  setErrorCount(0);
                  setLastErrorTime(0);
                  setError(null);
                }}
              >
                Clear Error State
              </Button>
            )}
          </div>
          {errorCount > 0 && (
            <small className="text-muted mt-2 d-block">
              Error attempts: {errorCount}/3
              {retryCountdown > 0 && ` • Next retry available in ${retryCountdown}s`}
            </small>
          )}
        </Alert>
      </Container>
    );
  }

  const categories = availableCategories;
  const displayedCount = visibleIcons.length;

  return (
    <Container fluid className="p-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <h2 className="mb-2">Icon Browser</h2>
              <p className="text-muted mb-0">Browse and copy icons for Mermaid diagrams</p>
            </div>
            <div className="text-end" style={{ maxWidth: '50%' }}>
              <div className="d-flex flex-wrap justify-content-end gap-2">
                {/* <Badge bg="primary">{totalIconCount} Total Icons</Badge>
                {IconService.getBadgeInfo().map(b => (
                  <Badge key={b.name} bg={b.badgeColor} style={{ fontSize: '0.75rem' }}>
                    {(b.displayName.length > 15 ? `${b.displayName.slice(0, 12)}…` : b.displayName)}: {b.iconCount}
                  </Badge>
                ))} */}
              </div>
            </div>
          </div>

          {/* Controls */}
          <Row className="mb-4">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Search Icons</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Search by name or pack..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Button variant="outline-secondary" onClick={() => setSearchTerm('')}>Clear</Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Icon Pack</Form.Label>
                <Form.Select
                  value={selectedIconPack}
                  onChange={(e) => setSelectedIconPack(e.target.value)}
                >
                  {availableIconPacks.map(pack => (
                    <option key={pack.name} value={pack.name}>{pack.displayName}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Diagram Type</Form.Label>
                <Form.Select
                  value={selectedDiagramType}
                  onChange={(e) => setSelectedDiagramType(e.target.value)}
                >
                  {Object.entries(DIAGRAM_TYPES).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <div className="pt-4">
                <small className="text-muted">Showing {displayedCount} of {filteredIcons.length} icons</small>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-2"
                  onClick={() => setShowInstructions(s => !s)}
                  aria-controls="usage-instructions"
                  aria-expanded={showInstructions}
                >
                  Usage Instructions
                </Button>
              </div>
            </Col>
          </Row>

          {/* Instructions */}
          <Collapse in={showInstructions}>
            <div id="usage-instructions">
              <Alert variant="info" className="mb-4">
                <Alert.Heading className="h6">How to Use Icons in {DIAGRAM_TYPES[selectedDiagramType].label}</Alert.Heading>
                <p className="mb-2">Click “Copy Usage” on an icon to copy the syntax ({DIAGRAM_TYPES[selectedDiagramType].description}).</p>
                {selectedDiagramType === 'architecture' ? (
                  <>
                    <code>service myec2(awssvg:ec2)[My EC2 Instance]</code><br />
                    <code>group myvpc(awsgrp:vpc)[My VPC Group]</code><br />
                    <code>service mylogo(logos:aws)[AWS Logo]</code>
                  </>
                ) : (
                  <>
                    <code>A@{`{ icon: "awssvg:ec2", form: "square", label: "EC2" }`}</code><br />
                    <code>B@{`{ icon: "awsgrp:vpc", form: "circle", label: "VPC" }`}</code><br />
                    <code>C@{'{ icon: "logos:aws", form: "rounded", label: "AWS" }'}</code>
                  </>
                )}
              </Alert>
            </div>
          </Collapse>

          {/* Grid */}
          <Row>
            {visibleIcons.map((icon, idx) => (
              <Col key={`${icon.prefix}-${icon.key}-${idx}`} xl={3} lg={4} md={6} className="mb-4">
                <Card className="h-100">
                  <Card.Body className="d-flex flex-column">
                    <div className="d-flex align-items-center mb-3">
                      {renderSVG(icon.iconData)}
                      <div className="ms-3 flex-grow-1">
                        <h6 className="mb-1" style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180
                        }} title={icon.key}>
                          {icon.key}
                        </h6>
                        <div className="mb-1">
                          <Badge
                            bg={IconService.getPackBadgeColor(icon.pack)}
                            className="me-1"
                            style={{ fontSize: '0.7rem' }}
                          >
                            {icon.packDisplayName.length > 12 ? `${icon.packDisplayName.slice(0, 9)}…` : icon.packDisplayName}
                          </Badge>
                          {icon.category !== icon.pack && (
                            <Badge bg="outline-secondary" className="small" style={{ fontSize: '0.65rem' }}>
                              {icon.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mb-2">
                      <small className="text-muted">Mermaid Reference:</small>
                      <div className="font-monospace small bg-body-tertiary p-2 rounded"
                           style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                           title={icon.fullName}>
                        {icon.fullName}
                      </div>
                    </div>

                    <div className="mb-3">
                      <small className="text-muted">{DIAGRAM_TYPES[selectedDiagramType].label} Usage:</small>
                      <div className="font-monospace small bg-body-tertiary p-2 rounded"
                           style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                           title={icon.usage}>
                        {icon.usage}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <Row>
                        <Col>
                          <Button
                            variant="outline-primary" size="sm" className="w-100"
                            onClick={() => copyToClipboard(icon.fullName)}
                          >
                            {copied === icon.fullName ? 'Copied!' : 'Copy Name'}
                          </Button>
                        </Col>
                        <Col>
                          <Button
                            variant="primary" size="sm" className="w-100"
                            onClick={() => copyToClipboard(icon.usage)}
                          >
                            {copied === icon.usage ? 'Copied!' : 'Copy Usage'}
                          </Button>
                        </Col>
                      </Row>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Search loading overlay */}
          {searchLoading && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Searching icons...</span>
              </div>
              <p className="mt-2 text-muted">Searching icons…</p>
            </div>
          )}

          {/* Loading hint */}
          {!searchLoading && visibleIcons.length < filteredIcons.length && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading more icons...</span>
              </div>
              <p className="mt-2 text-muted">Scroll down for more icons…</p>
            </div>
          )}

          {!searchLoading && visibleIcons.length === 0 && !loading && (
            <Alert variant="warning" className="text-center">
              <h5>No icons found</h5>
              <p>Try adjusting your search term, icon pack, or category filter.</p>
            </Alert>
          )}
        </Col>
      </Row>
    </Container>
  );
}

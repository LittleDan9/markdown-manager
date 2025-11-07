import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Container, Row, Col, Card, Form, Badge, Button, Alert, InputGroup, Collapse } from 'react-bootstrap';
import { useLogger } from '../../providers/LoggerProvider';
import { serviceFactory } from '@/services/injectors';
import { ActionButton } from '@/components/shared';
import { cleanSvgBodyForBrowser } from '@/utils/svgUtils';

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
  const iconService = serviceFactory.createIconService();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIconPack, setSelectedIconPack] = useState('all');
  const [selectedDiagramType, setSelectedDiagramType] = useState(
    () => localStorage.getItem('iconBrowser_diagramType') || 'architecture'
  );
  const [availableIconPacks, setAvailableIconPacks] = useState([]);
  const [availableCategories, setAvailableCategories] = useState(['all']);
  const [allIcons, setAllIcons] = useState([]); // All loaded icons (across pages)
  const [totalIconCount, setTotalIconCount] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState('');

  // Server-side pagination state
  const [hasMoreIcons, setHasMoreIcons] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const PAGE_SIZE = 100; // Match backend page size

  // Persist diagram type
  useEffect(() => {
    localStorage.setItem('iconBrowser_diagramType', selectedDiagramType);
  }, [selectedDiagramType]);

  // Simple retry function
  const retryLoading = () => {
    setError(null);
    // Force re-render which will trigger the useEffect hooks again
    window.location.reload();
  };

  // Load icon packs metadata only (not all icons)
  useEffect(() => {
    const loadIconPacks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load only the icon packs metadata, not all icons
        const response = await iconService.getIconPacks();

        if (!Array.isArray(response)) {
          setError('Invalid response format from icon packs API');
          return;
        }

        setAvailableIconPacks(response);

        // Extract unique categories
        const categories = ['all', ...new Set(response.map(pack => pack.category))];
        setAvailableCategories(categories);

      } catch (e) {
        console.error('Failed to load icon packs', e);
        setError(`Failed to load icon packs: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadIconPacks();
  }, []); // No dependencies - only run once on mount

  // Initial search after icon packs are loaded
  useEffect(() => {
    if (availableIconPacks.length === 0) return;

    const performInitialSearch = async () => {
      try {
        setSearchLoading(true);
        setError(null);

        // Reset pagination for new search
        setAllIcons([]);
        setCurrentPage(0);

        // Use server-side search API with initial defaults
        const response = await iconService.searchIcons(
          '',           // empty search term
          'all',        // all categories
          'all',        // all packs
          0,            // page
          PAGE_SIZE     // size
        );

        setAllIcons(response.icons || []);
        setTotalIconCount(response.total || 0);
        setHasMoreIcons(response.has_next || false);

      } catch (error) {
        console.error('Initial search failed:', error);
        setError(`Failed to load icons: ${error.message}`);
      } finally {
        setSearchLoading(false);
      }
    };

    performInitialSearch();
  }, [availableIconPacks]); // Only when icon packs are first loaded

  // Server-side search when filters change (not on initial load)
  useEffect(() => {
    // Skip if this is the initial load (availableIconPacks just got populated)
    if (availableIconPacks.length === 0) return;

    // Skip if this is the initial values (empty search, all categories, all packs)
    if (searchTerm === '' && selectedCategory === 'all' && selectedIconPack === 'all') return;

    const searchIcons = async () => {
      try {
        setSearchLoading(true);
        setError(null);

        // Reset pagination for new search
        setAllIcons([]);
        setCurrentPage(0);

        // Use server-side search API
        const response = await iconService.searchIcons(
          searchTerm,
          selectedCategory,
          selectedIconPack,
          0, // page
          PAGE_SIZE // size
        );

        setAllIcons(response.icons || []);
        setTotalIconCount(response.total || 0);
        setHasMoreIcons(response.has_next || false);

      } catch (error) {
        console.error('Search failed:', error);
        setAllIcons([]);
        setTotalIconCount(0);
        setHasMoreIcons(false);
        setError(`Search failed: ${error.message}`);
      } finally {
        setSearchLoading(false);
      }
    };

    searchIcons();
  }, [searchTerm, selectedCategory, selectedIconPack]); // Removed log dependency

  // Memoize icons with usage examples to avoid unnecessary re-renders
  const iconsWithUsage = useMemo(() => {
    if (!allIcons || !Array.isArray(allIcons)) return [];
    return allIcons.map(icon => ({
      ...icon,
      usage: iconService.generateUsageExample(icon.pack || 'unknown', icon.key, selectedDiagramType)
    }));
  }, [allIcons, selectedDiagramType]);

  // Load more icons when scrolling (server-side pagination)
  const loadMoreIcons = useCallback(async () => {
    if (isLoadingMore || !hasMoreIcons) return;

    try {
      setIsLoadingMore(true);

      const nextPage = currentPage + 1;
      const response = await iconService.searchIcons(
        searchTerm,
        selectedCategory,
        selectedIconPack,
        nextPage,
        PAGE_SIZE
      );

      // Append new icons to existing ones
      setAllIcons(prev => [...(prev || []), ...(response.icons || [])]);
      setHasMoreIcons(response.has_next || false);
      setCurrentPage(nextPage);

    } catch (error) {
      console.error('Failed to load more icons:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreIcons, currentPage, searchTerm, selectedCategory, selectedIconPack]);

  // Simple infinite scroll for server-side pagination
  useEffect(() => {
    const handleScroll = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;

      // Trigger load more when near bottom and we have more icons
      if (scrollHeight - scrollTop <= clientHeight + 400 && hasMoreIcons && !isLoadingMore) {
        loadMoreIcons();
      }
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [hasMoreIcons, isLoadingMore, loadMoreIcons]);

  // All loaded icons are already visible (server-side pagination)
  const visibleIcons = iconsWithUsage;

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

    // Clean the body content to remove namespaces for browser compatibility
    const cleanedBody = cleanSvgBodyForBrowser(iconData.body);

    // Create complete SVG with proper styling support
    const viewBox = iconData.viewBox || '0 0 24 24';
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="${viewBox}" class="border rounded bg-body-secondary" style="padding: 4px;">${cleanedBody}</svg>`;

    return (
      <div
        dangerouslySetInnerHTML={{ __html: svgContent }}
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
          <ActionButton
            variant="outline-danger"
            onClick={retryLoading}
            icon="arrow-clockwise"
          >
            Retry
          </ActionButton>
        </Alert>
      </Container>
    );
  }

  const categories = availableCategories;
  const displayedCount = iconsWithUsage.length;

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
                {iconService.getBadgeInfo().map(b => (
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
                    <ActionButton
                      variant="outline-secondary"
                      onClick={() => setSearchTerm('')}
                      icon="x"
                      size="sm"
                    >
                      Clear
                    </ActionButton>
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
                  <option value="all">All Packs</option>
                  {availableIconPacks.map(pack => (
                    <option key={pack.name} value={pack.name}>
                      {pack.display_name || pack.name}
                    </option>
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
                <small className="text-muted">Showing {displayedCount} of {totalIconCount} icons</small>
                <ActionButton
                  variant="link"
                  size="sm"
                  className="p-0 ms-2"
                  onClick={() => setShowInstructions(s => !s)}
                  aria-controls="usage-instructions"
                  aria-expanded={showInstructions}
                  icon={showInstructions ? "chevron-up" : "chevron-down"}
                >
                  Usage Instructions
                </ActionButton>
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
                            bg={iconService.getPackBadgeColor(icon.pack)}
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
                          <ActionButton
                            variant="outline-primary"
                            size="sm"
                            className="w-100"
                            onClick={() => copyToClipboard(icon.fullName)}
                            loading={copied === icon.fullName}
                            icon={copied === icon.fullName ? "check" : "clipboard"}
                          >
                            {copied === icon.fullName ? 'Copied!' : 'Copy Name'}
                          </ActionButton>
                        </Col>
                        <Col>
                          <ActionButton
                            variant="primary"
                            size="sm"
                            className="w-100"
                            onClick={() => copyToClipboard(icon.usage)}
                            loading={copied === icon.usage}
                            icon={copied === icon.usage ? "check" : "clipboard"}
                          >
                            {copied === icon.usage ? 'Copied!' : 'Copy Usage'}
                          </ActionButton>
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
          {!searchLoading && hasMoreIcons && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading more icons...</span>
              </div>
              <p className="mt-2 text-muted">Scroll down for more icons…</p>
            </div>
          )}

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading more icons...</span>
              </div>
              <p className="mt-2 text-muted">Loading more icons...</p>
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Row, Col, Card, Form, Badge, Button, Alert, InputGroup, Collapse, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useLogger } from '../context/LoggerProvider';
import AwsIconLoader from '../services/AwsIconLoader';

const IconBrowser = () => {
  const [icons, setIcons] = useState([]);
  const [allIconsMetadata, setAllIconsMetadata] = useState([]); // Store all possible icons for search
  const [filteredIcons, setFilteredIcons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDiagramType, setSelectedDiagramType] = useState(() => {
    // Initialize from localStorage, fallback to 'architecture'
    return localStorage.getItem('iconBrowser_diagramType') || 'architecture';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedIcon, setCopiedIcon] = useState(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 24 });
  const [hasLoadedAllCategories, setHasLoadedAllCategories] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const logger = useLogger('IconBrowser');

  // Constants for virtualization
  const ITEMS_PER_ROW = 4; // Based on xl=3 (4 columns in XL)
  const INITIAL_LOAD_SIZE = 24; // Load 6 rows initially
  const LOAD_MORE_SIZE = 16; // Load 4 more rows when scrolling

  // Diagram type configurations
  const diagramTypes = {
    architecture: {
      label: 'Architecture Diagram',
      description: 'architecture-beta diagrams',
      serviceUsage: (key) => `service myservice(awssvg:${key})[My Service]`,
      groupUsage: (key) => `group mygroup(awsgrp:${key})[My Group]`,
      categoryUsage: (key) => `service mycategory(awscat:${key})[My Category]`,
      resourceUsage: (key) => `service myresource(awsres:${key})[My Resource]`
    },
    flowchart: {
      label: 'Flowchart',
      description: 'flowchart diagrams with icon shapes',
      serviceUsage: (key) => `A@{ icon: "awssvg:${key}", form: "square", label: "Service" }`,
      groupUsage: (key) => `A@{ icon: "awsgrp:${key}", form: "circle", label: "Group" }`,
      categoryUsage: (key) => `A@{ icon: "awscat:${key}", form: "rounded", label: "Category" }`,
      resourceUsage: (key) => `A@{ icon: "awsres:${key}", form: "square", label: "Resource" }`
    }
  };

  useEffect(() => {
    loadIcons();
  }, []);

  // Save diagram type to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('iconBrowser_diagramType', selectedDiagramType);
    logger.debug(`Saved diagram type to localStorage: ${selectedDiagramType}`);
  }, [selectedDiagramType, logger]);

  useEffect(() => {
    filterIcons();
  }, [allIconsMetadata, searchTerm, selectedCategory]);

  // Reset visible range when filters change and we're in virtualized mode
  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(INITIAL_LOAD_SIZE, filteredIcons.length) });
  }, [filteredIcons.length, INITIAL_LOAD_SIZE]);

  // Main scroll handler for dynamic loading
  useEffect(() => {
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

      // Check if we're near the bottom (within 400px) and haven't loaded all visible icons
      if (scrollHeight - scrollTop <= clientHeight + 400 && visibleRange.end < filteredIcons.length) {
        setVisibleRange(prev => ({
          start: prev.start,
          end: Math.min(prev.end + LOAD_MORE_SIZE, filteredIcons.length)
        }));
      }

      // Auto-load more categories when user scrolls to near the end and we haven't loaded all yet
      if (!hasLoadedAllCategories &&
          scrollHeight - scrollTop <= clientHeight + 600 &&
          visibleRange.end >= Math.min(filteredIcons.length, 100)) {
        loadAllCategories();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredIcons.length, visibleRange.end, hasLoadedAllCategories, LOAD_MORE_SIZE]);

  // Memoize visible icons to prevent unnecessary re-renders
  const visibleIcons = useMemo(() => {
    const visibleSet = filteredIcons.slice(visibleRange.start, visibleRange.end);
    logger.debug(`Showing ${visibleSet.length} of ${filteredIcons.length} icons (range: ${visibleRange.start}-${visibleRange.end})`);
    return visibleSet;
  }, [filteredIcons, visibleRange, logger]);

  const loadAllCategories = useCallback(async () => {
    if (hasLoadedAllCategories) return;

    try {
      setHasLoadedAllCategories(true);
      const metadata = await AwsIconLoader.getIconMetadata();

      // Remove duplicates (same iconData reference but different keys)
      const uniqueIcons = [];
      const seenIconData = new Set();

      metadata.forEach(icon => {
        const iconKey = `${icon.category}-${icon.iconData.body}`;
        if (!seenIconData.has(iconKey)) {
          seenIconData.add(iconKey);
          uniqueIcons.push(icon);
        }
      });

      setIcons(uniqueIcons);
      setAllIconsMetadata(uniqueIcons); // Update all icons metadata for search
      logger.info(`Loaded all ${uniqueIcons.length} unique icons for browsing`);
    } catch (err) {
      logger.error('Failed to load all icon categories:', err);
      setHasLoadedAllCategories(false); // Allow retry
    }
  }, [hasLoadedAllCategories, logger]);

  const loadIcons = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load metadata for all icons first for search purposes
      const allMetadata = await AwsIconLoader.getIconMetadata();

      // Remove duplicates (same iconData reference but different keys)
      const uniqueAllIcons = [];
      const seenIconData = new Set();

      allMetadata.forEach(icon => {
        const iconKey = `${icon.category}-${icon.iconData.body}`;
        if (!seenIconData.has(iconKey)) {
          seenIconData.add(iconKey);
          uniqueAllIcons.push(icon);
        }
      });

      setAllIconsMetadata(uniqueAllIcons); // Store all for search

      // Load only the service icons initially for display
      const servicePack = await AwsIconLoader.getAwsServiceIcons();
      const displayMetadata = [];
      if (servicePack && servicePack.icons) {
        Object.entries(servicePack.icons).forEach(([key, iconData]) => {
          displayMetadata.push({
            key,
            prefix: 'awssvg',
            fullName: `awssvg:${key}`,
            category: 'service',
            iconData,
            usage: diagramTypes[selectedDiagramType].serviceUsage(key)
          });
        });
      }

      // Remove duplicates from display icons
      const uniqueDisplayIcons = [];
      const seenDisplayIconData = new Set();

      displayMetadata.forEach(icon => {
        const iconKey = `${icon.category}-${icon.iconData.body}`;
        if (!seenDisplayIconData.has(iconKey)) {
          seenDisplayIconData.add(iconKey);
          uniqueDisplayIcons.push(icon);
        }
      });

      setIcons(uniqueDisplayIcons);
      logger.info(`Loaded ${uniqueDisplayIcons.length} unique service icons for display and ${uniqueAllIcons.length} total icons for search`);
    } catch (err) {
      logger.error('Failed to load icon metadata:', err);
      setError('Failed to load AWS icons. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const filterIcons = () => {
    let filtered = allIconsMetadata; // Use all icons metadata for filtering

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(icon =>
        icon.key.toLowerCase().includes(term) ||
        icon.fullName.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(icon => icon.category === selectedCategory);
    }

    setFilteredIcons(filtered);

    // If we have search results that aren't currently loaded, we need to load them
    if (filtered.length > 0 && !hasLoadedAllCategories) {
      const hasNonServiceIcons = filtered.some(icon => icon.category !== 'service');
      if (hasNonServiceIcons) {
        loadAllCategories();
      }
    }
  };

  // Update usage examples when diagram type changes
  useEffect(() => {
    if (allIconsMetadata.length > 0) {
      setAllIconsMetadata(prevIcons => prevIcons.map(icon => ({
        ...icon,
        usage: diagramTypes[selectedDiagramType][`${icon.category}Usage`](icon.key)
      })));
    }
    if (icons.length > 0) {
      setIcons(prevIcons => prevIcons.map(icon => ({
        ...icon,
        usage: diagramTypes[selectedDiagramType][`${icon.category}Usage`](icon.key)
      })));
    }
  }, [selectedDiagramType]); // Only depend on selectedDiagramType

  const copyToClipboard = async (text, iconKey) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIcon(iconKey);
      setTimeout(() => setCopiedIcon(null), 2000);
      logger.debug(`Copied to clipboard: ${text}`);
    } catch (err) {
      logger.warn('Failed to copy to clipboard:', err);
    }
  };

  const renderIcon = (iconData) => {
    if (!iconData || !iconData.body) {
      return (
        <div
          className="d-flex align-items-center justify-content-center border rounded bg-body-secondary"
          style={{ width: '48px', height: '48px' }}
        >
          <small className="text-muted">?</small>
        </div>
      );
    }

    return (
      <svg
        width="48"
        height="48"
        viewBox={iconData.viewBox || '0 0 64 64'}
        className="border rounded bg-body-secondary"
        style={{ padding: '4px' }}
        dangerouslySetInnerHTML={{ __html: iconData.body }}
      />
    );
  };

  const categories = ['all', 'service', 'group', 'category', 'resource'];
  const serviceCount = allIconsMetadata.filter(icon => icon.category === 'service').length;
  const groupCount = allIconsMetadata.filter(icon => icon.category === 'group').length;
  const categoryCount = allIconsMetadata.filter(icon => icon.category === 'category').length;
  const resourceCount = allIconsMetadata.filter(icon => icon.category === 'resource').length;

  const totalIcons = serviceCount + groupCount + categoryCount + resourceCount;
  const displayedCount = visibleIcons.length;

  if (loading) {
    return (
      <Container className="p-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading AWS icons...</p>
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
          <Button variant="outline-danger" onClick={loadIcons}>
            Retry
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="p-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="mb-2">AWS Icon Browser</h2>
              <p className="text-muted mb-0">
                Browse and copy AWS icons for use in Mermaid diagrams
                {!hasLoadedAllCategories && (
                  <OverlayTrigger
                    placement="right"
                    overlay={
                      <Tooltip>
                        Smart loading: Started with AWS Service icons for faster initial load.
                        Groups, Categories, and Resources load automatically as you scroll or search.
                      </Tooltip>
                    }
                  >
                    <span className="ms-2 text-info" style={{ cursor: 'help' }}>
                      <i className="bi bi-info-circle"></i>
                    </span>
                  </OverlayTrigger>
                )}
              </p>
            </div>
            <div className="text-end">
              <Badge bg="primary" className="me-2">
                {serviceCount} Services
              </Badge>
              {allIconsMetadata.length > 0 && (
                <>
                  <Badge bg="secondary" className="me-2">
                    {groupCount} Groups
                  </Badge>
                  <Badge bg="info" className="me-2">
                    {categoryCount} Categories
                  </Badge>
                  <Badge bg="success">
                    {resourceCount} Resources
                  </Badge>
                </>
              )}
              {!hasLoadedAllCategories && (groupCount + categoryCount + resourceCount > 0) && (
                <Badge bg="warning" className="ms-2">
                  Loading more...
                </Badge>
              )}
            </div>
          </div>

          {/* Search and Filter Controls */}
          <Row className="mb-4">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Search Icons</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Search by name (e.g., ec2, lambda, vpc...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Button
                      variant="outline-secondary"
                      onClick={() => setSearchTerm('')}
                    >
                      Clear
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' :
                       category === 'service' ? 'AWS Services' :
                       category === 'group' ? 'AWS Groups' :
                       category === 'category' ? 'AWS Categories' :
                       'AWS Resources'}
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
                  {Object.entries(diagramTypes).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <div className="pt-4">
                <small className="text-muted">
                  Showing {displayedCount} of {filteredIcons.length} icons
                </small>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-2"
                  onClick={() => setShowInstructions(!showInstructions)}
                  aria-controls="usage-instructions"
                  aria-expanded={showInstructions}
                >
                  Usage Instructions
                </Button>
              </div>
            </Col>
          </Row>

          {/* Collapsible Usage Instructions */}
          <Collapse in={showInstructions}>
            <div id="usage-instructions">
              <Alert variant="info" className="mb-4">
                <Alert.Heading className="h6">How to Use Icons in {diagramTypes[selectedDiagramType].label}</Alert.Heading>
                <p className="mb-2">
                  Click the "Copy Usage" button on any icon to copy the {diagramTypes[selectedDiagramType].description} syntax. Examples:
                </p>
                {selectedDiagramType === 'architecture' ? (
                  <>
                    <code>service myec2(awssvg:ec2)[My EC2 Instance]</code>
                    <br />
                    <code>group myvpc(awsgrp:vpc)[My VPC Group]</code>
                    <br />
                    <code>service mycat(awscat:compute)[Compute Category]</code>
                    <br />
                    <code>service myres(awsres:bucket)[S3 Bucket Resource]</code>
                  </>
                ) : (
                  <>
                    <code>A@{`{ icon: "awssvg:ec2", form: "square", label: "EC2" }`}</code>
                    <br />
                    <code>B@{`{ icon: "awsgrp:vpc", form: "circle", label: "VPC" }`}</code>
                    <br />
                    <code>C@{`{ icon: "awscat:compute", form: "rounded", label: "Compute" }`}</code>
                    <br />
                    <code>D@{`{ icon: "awsres:bucket", form: "square", label: "S3" }`}</code>
                  </>
                )}
              </Alert>
            </div>
          </Collapse>

          {/* Icons Grid - Using main page scroll */}
          <Row>
            {visibleIcons.map((icon, index) => (
              <Col key={`${icon.prefix}-${icon.key}-${index}`} xl={3} lg={4} md={6} className="mb-4">
                <Card className="h-100">
                  <Card.Body className="d-flex flex-column">
                    <div className="d-flex align-items-center mb-3">
                      {renderIcon(icon.iconData)}
                      <div className="ms-3 flex-grow-1">
                        <h6 className="mb-1">{icon.key}</h6>
                        <Badge
                          bg={
                            icon.category === 'service' ? 'primary' :
                            icon.category === 'group' ? 'secondary' :
                            icon.category === 'category' ? 'info' :
                            'success'
                          }
                          className="mb-1"
                        >
                          {icon.category}
                        </Badge>
                      </div>
                    </div>

                    <div className="mb-2">
                      <small className="text-muted">Mermaid Reference:</small>
                      <div className="font-monospace small bg-body-tertiary p-2 rounded">
                        {icon.fullName}
                      </div>
                    </div>

                    <div className="mb-3">
                      <small className="text-muted">{diagramTypes[selectedDiagramType].label} Usage:</small>
                      <div className="font-monospace small bg-body-tertiary p-2 rounded">
                        {icon.usage}
                      </div>
                    </div>

                    <div className="mt-auto">
                      <Row>
                        <Col>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="w-100"
                            onClick={() => copyToClipboard(icon.fullName, icon.fullName)}
                          >
                            {copiedIcon === icon.fullName ? 'Copied!' : 'Copy Name'}
                          </Button>
                        </Col>
                        <Col>
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-100"
                            onClick={() => copyToClipboard(icon.usage, icon.usage)}
                          >
                            {copiedIcon === icon.usage ? 'Copied!' : 'Copy Usage'}
                          </Button>
                        </Col>
                      </Row>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Load more indicator */}
          {visibleIcons.length < filteredIcons.length && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading more icons...</span>
              </div>
              <p className="mt-2 text-muted">Scroll down for more icons...</p>
            </div>
          )}

          {/* Loading more categories indicator */}
          {!hasLoadedAllCategories && visibleIcons.length >= 80 && (
            <div className="text-center py-4">
              <Alert variant="info" className="d-inline-block">
                <div className="d-flex align-items-center">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  Loading Groups, Categories, and Resources...
                </div>
              </Alert>
            </div>
          )}

          {visibleIcons.length === 0 && !loading && (
            <Alert variant="warning" className="text-center">
              <h5>No icons found</h5>
              <p>
                {!hasLoadedAllCategories
                  ? "Try scrolling down to load more icon types, or adjust your search term."
                  : "Try adjusting your search term or category filter."
                }
              </p>
            </Alert>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default IconBrowser;

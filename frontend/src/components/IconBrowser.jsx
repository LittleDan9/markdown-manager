import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Badge, Button, Alert, InputGroup } from 'react-bootstrap';
import { useLogger } from '../context/LoggerProvider';
import AwsIconLoader from '../services/AwsIconLoader';

const IconBrowser = () => {
  const [icons, setIcons] = useState([]);
  const [filteredIcons, setFilteredIcons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedIcon, setCopiedIcon] = useState(null);
  const logger = useLogger('IconBrowser');

  useEffect(() => {
    loadIcons();
  }, []);

  useEffect(() => {
    filterIcons();
  }, [icons, searchTerm, selectedCategory]);

  const loadIcons = async () => {
    try {
      setLoading(true);
      setError(null);
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
      logger.info(`Loaded ${uniqueIcons.length} unique icons for browsing`);
    } catch (err) {
      logger.error('Failed to load icon metadata:', err);
      setError('Failed to load AWS icons. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const filterIcons = () => {
    let filtered = icons;

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
  };

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
  const serviceCount = icons.filter(icon => icon.category === 'service').length;
  const groupCount = icons.filter(icon => icon.category === 'group').length;
  const categoryCount = icons.filter(icon => icon.category === 'category').length;
  const resourceCount = icons.filter(icon => icon.category === 'resource').length;

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
                Browse and copy AWS icons for use in Mermaid architecture diagrams
              </p>
            </div>
            <div className="text-end">
              <Badge bg="primary" className="me-2">
                {serviceCount} Services
              </Badge>
              <Badge bg="secondary" className="me-2">
                {groupCount} Groups
              </Badge>
              <Badge bg="info" className="me-2">
                {categoryCount} Categories
              </Badge>
              <Badge bg="success">
                {resourceCount} Resources
              </Badge>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <Row className="mb-4">
            <Col md={6}>
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
              <div className="pt-4">
                <small className="text-muted">
                  Showing {filteredIcons.length} of {icons.length} icons
                </small>
              </div>
            </Col>
          </Row>

          {/* Usage Instructions */}
          <Alert variant="info" className="mb-4">
            <Alert.Heading className="h6">How to Use Icons in Mermaid</Alert.Heading>
            <p className="mb-2">
              Click the "Copy Usage" button on any icon to copy the Mermaid syntax. Examples:
            </p>
            <code>service myec2(awssvg:ec2)[My EC2 Instance]</code>
            <br />
            <code>group myvpc(awsgrp:vpc)[My VPC Group]</code>
            <br />
            <code>service mycat(awscat:compute)[Compute Category]</code>
            <br />
            <code>service myres(awsres:bucket)[S3 Bucket Resource]</code>
          </Alert>

          {/* Icons Grid */}
          <Row>
            {filteredIcons.map((icon, index) => (
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
                      <small className="text-muted">Usage Example:</small>
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

          {filteredIcons.length === 0 && !loading && (
            <Alert variant="warning" className="text-center">
              <h5>No icons found</h5>
              <p>Try adjusting your search term or category filter.</p>
            </Alert>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default IconBrowser;

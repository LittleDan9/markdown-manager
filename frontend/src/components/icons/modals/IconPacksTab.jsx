import React from 'react';
import { Card, ListGroup, Badge } from 'react-bootstrap';

export default function IconPacksTab({ iconPacks }) {
  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Existing Icon Packs</h5>
      </Card.Header>
      <Card.Body>
        {iconPacks.length === 0 ? (
          <div className="text-center text-muted py-4">
            <i className="bi bi-collection display-4"></i>
            <p className="mt-2">No icon packs found</p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <ListGroup variant="flush">
              {iconPacks.map(pack => (
                <ListGroup.Item key={pack.id} className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">{pack.display_name}</h6>
                    <p className="mb-1 text-muted">{pack.description}</p>
                    <small className="text-muted">
                      Pack: {pack.name} | Category: {pack.category}
                    </small>
                  </div>
                  <Badge bg="primary" pill>
                    {pack.icon_count} icons
                  </Badge>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

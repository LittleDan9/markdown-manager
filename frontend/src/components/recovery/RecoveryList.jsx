import React from "react";
import { ListGroup, Button } from "react-bootstrap";

export default function RecoveryList({ docs, onReview, onDiscardAll }) {
  return (
    <div>
      <h5>Recovered Documents</h5>
      <ListGroup>
        {docs.map(doc => (
          <ListGroup.Item key={doc.id}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{doc.name}</strong> <span className="text-muted">({doc.category})</span>
                <br />
                <small>Recovered: {doc.recoveredAt}</small>
                {doc.collision && <span className="text-danger ms-2">Collision</span>}
              </div>
              <Button variant="primary" size="sm" onClick={() => onReview(doc)}>Review</Button>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
      <Button variant="danger" className="mt-3" onClick={onDiscardAll}>Discard All</Button>
    </div>
  );
}

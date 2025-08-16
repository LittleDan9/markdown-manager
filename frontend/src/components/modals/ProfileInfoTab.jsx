import React from "react";
import { Form, Row, Col, Button, Alert } from "react-bootstrap";

function ProfileInfoTab({ form, handleChange, error, success, handleSubmit }) {

  return (
    <Form id="profileForm" className="mt-3" onSubmit={handleSubmit}>
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group controlId="profileFirstName">
            <Form.Label>First Name</Form.Label>
            <Form.Control type="text" value={form.profileFirstName} onChange={handleChange} />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="profileLastName">
            <Form.Label>Last Name</Form.Label>
            <Form.Control type="text" value={form.profileLastName} onChange={handleChange} />
          </Form.Group>
        </Col>
      </Row>
      <Form.Group className="mb-3" controlId="profileDisplayName">
        <Form.Label>Display Name</Form.Label>
        <Form.Control type="text" value={form.profileDisplayName} onChange={handleChange} />
      </Form.Group>
      <Form.Group className="mb-3" controlId="profileEmail">
        <Form.Label>Email</Form.Label>
        <Form.Control type="email" value={form.profileEmail} readOnly />
        <Form.Text>Email cannot be changed.</Form.Text>
      </Form.Group>
      <Form.Group className="mb-3" controlId="profileBio">
        <Form.Label>Bio</Form.Label>
        <Form.Control as="textarea" rows={3} value={form.profileBio} onChange={handleChange} />
      </Form.Group>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <div className="d-flex justify-content-end gap-2">
        <Button type="submit" variant="primary">Save Changes</Button>
      </div>
    </Form>
  );
}

export default ProfileInfoTab;

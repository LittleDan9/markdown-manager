import React, { useState, useRef } from "react";
import { Modal, Button, Form, Row, Col, Alert, Accordion, ProgressBar } from "react-bootstrap";

function RegisterModal({ show, onHide, onRegister, error }) {
  // Refs for first field in each panel
  const firstNameRef = useRef(null);
  const passwordRef = useRef(null);
  const bioRef = useRef(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    email: "",
    confirm_email: "",
    password: "",
    confirm_password: "",
    bio: ""
  });

  const [emailMatchError, setEmailMatchError] = useState("");
  const [passwordMatchError, setPasswordMatchError] = useState("");
  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm({ ...form, [id]: value });

    if (id === "email" || id === "confirm_email") {
      if (
        (id === "email" && value !== form.confirm_email) ||
        (id === "confirm_email" && value !== form.email)
      ) {
        setEmailMatchError("Email addresses do not match.");
      } else {
        setEmailMatchError("");
      }
    }
    if (id === "password" || id === "confirm_password") {
      if (
        (id === "password" && value !== form.confirm_password) ||
        (id === "confirm_password" && value !== form.password)
      ) {
        setPasswordMatchError("Passwords do not match.");
      } else {
        setPasswordMatchError("");
      }
    }
  };

  // Step validation
  const validateStep1 = () => {
    if (!form.first_name || !form.last_name || !form.email || !form.confirm_email) return false;
    if (form.email !== form.confirm_email) return false;
    return true;
  };
  const validateStep2 = () => {
    if (!form.password || !form.confirm_password) return false;
    if (form.password.length < 6) return false;
    if (form.password !== form.confirm_password) return false;
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) {
      setEmailMatchError("Please complete all fields and ensure emails match.");
      return;
    }
    if (step === 2 && !validateStep2()) {
      setPasswordMatchError("Please complete all fields and ensure passwords match.");
      return;
    }
    setEmailMatchError("");
    setPasswordMatchError("");
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateStep1()) {
      setEmailMatchError("Please complete all fields and ensure emails match.");
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setPasswordMatchError("Please complete all fields and ensure passwords match.");
      setStep(2);
      return;
    }
    if (onRegister) onRegister(form);
  };

  // Keydown handlers for Enter key
  const handleStep1KeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext();
    }
  };
  const handleStep2KeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext();
    }
  };
  const handleStep3KeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title id="registerModalLabel">
          <i className="bi bi-person-plus me-2"></i>Create Account
        </Modal.Title>
      </Modal.Header>
      <Form id="registerForm" onSubmit={handleSubmit}>
        <Modal.Body>
          <ProgressBar now={step * 33.33} label={`Step ${step} of 3`} className="mb-3" />
          <Accordion activeKey={`step${step}`} alwaysOpen>
            {/* Step 1: Name/Email */}
            <Accordion.Item eventKey="step1">
              <Accordion.Header><i className="bi bi-person me-2"></i>Step 1: Name & Email</Accordion.Header>
              <Accordion.Body onKeyDown={handleStep1KeyDown} tabIndex={0} onEntered={() => {firstNameRef.current.focus()}}>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group controlId="first_name">
                      <Form.Label>First Name</Form.Label>
                      <Form.Control type="text" value={form.first_name} onChange={handleChange} required ref={firstNameRef} />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="last_name">
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control type="text" value={form.last_name} onChange={handleChange} required />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3" controlId="display_name">
                  <Form.Label>Display Name (Optional)</Form.Label>
                  <Form.Control type="text" value={form.display_name} onChange={handleChange} placeholder="How you'd like to be shown in the app" />
                </Form.Group>
                <Form.Group className="mb-3" controlId="email">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={form.email} onChange={handleChange} required />
                </Form.Group>
                <Form.Group className="mb-3" controlId="confirm_email">
                  <Form.Label>Confirm Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={form.confirm_email}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
                {emailMatchError && <Alert variant="danger">{emailMatchError}</Alert>}
                <div className="d-flex justify-content-end mt-4">
                  <Button variant="primary" onClick={handleNext}>Next <i className="bi bi-arrow-right ms-1"></i></Button>
                </div>
              </Accordion.Body>
            </Accordion.Item>
            {/* Step 2: Password/Confirm */}
            <Accordion.Item eventKey="step2">
              <Accordion.Header><i className="bi bi-key me-2"></i>Step 2: Set Password</Accordion.Header>
              <Accordion.Body onKeyDown={handleStep2KeyDown} tabIndex={0} onEntered={() => {passwordRef.current.focus()}}>
                <Form.Group className="mb-3" controlId="password">
                  <Form.Label>Password</Form.Label>
                  <Form.Control type="password" value={form.password} onChange={handleChange} required minLength={6} ref={passwordRef} />
                  <Form.Text>Password must be at least 6 characters long.</Form.Text>
                </Form.Group>
                <Form.Group className="mb-3" controlId="confirm_password">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control type="password" value={form.confirm_password} onChange={handleChange} required minLength={6} />
                </Form.Group>
                {passwordMatchError && <Alert variant="danger">{passwordMatchError}</Alert>}
                <div className="d-flex justify-content-between mt-4">
                  <Button variant="secondary" onClick={handleBack}><i className="bi bi-arrow-left me-1"></i>Back</Button>
                  <Button variant="primary" onClick={handleNext}>Next <i className="bi bi-arrow-right ms-1"></i></Button>
                </div>
              </Accordion.Body>
            </Accordion.Item>
            {/* Step 3: Bio */}
            <Accordion.Item eventKey="step3">
              <Accordion.Header><i className="bi bi-person-lines-fill me-2"></i>Step 3: Bio</Accordion.Header>
              <Accordion.Body onKeyDown={handleStep3KeyDown} tabIndex={0} onEntered={() => {bioRef.current.focus()}}>
                <Form.Group className="mb-3" controlId="bio">
                  <Form.Label>Bio (Optional)</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.bio} onChange={handleChange} placeholder="Tell us a bit about yourself..." ref={bioRef} />
                </Form.Group>
                {error && <Alert variant="danger">{error}</Alert>}
                <div className="d-flex justify-content-between mt-4">
                  <Button variant="secondary" onClick={handleBack}><i className="bi bi-arrow-left me-1"></i>Back</Button>
                  <Button type="submit" variant="primary">Create Account</Button>
                </div>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </Modal.Body>
      </Form>
    </Modal>
  );
}

export default RegisterModal;

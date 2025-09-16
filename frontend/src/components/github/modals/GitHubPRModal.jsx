import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import gitHubApi from "../../../api/gitHubApi";
import { useNotification } from "../../NotificationProvider";

export default function GitHubPRModal({
  show,
  onHide,
  repository,
  headBranch,
  onPRCreated
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [branches, setBranches] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (show && repository?.id) {
      loadBranches();
      setTitle(`Update documentation from ${headBranch}`);
      setBody(`This pull request contains updates to documentation files.

Changes made using Markdown Manager.`);
    }
  }, [show, repository, headBranch]);

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const branchesData = await gitHubApi.getRepositoryBranches(repository.id);
      setBranches(branchesData);

      // Set default base branch
      const defaultBranch = branchesData.find(b => b.is_default);
      if (defaultBranch) {
        setBaseBranch(defaultBranch.name);
      }
    } catch (error) {
      console.error("Failed to load branches:", error);
      showError("Failed to load repository branches");
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showError("Pull request title is required");
      return;
    }

    setCreating(true);
    try {
      const prData = {
        title: title.trim(),
        body: body.trim(),
        head_branch: headBranch,
        base_branch: baseBranch
      };

      const result = await gitHubApi.createPullRequest(repository.id, prData);

      showSuccess(`Pull request #${result.number} created successfully`);
      onPRCreated?.(result);
      onHide();

    } catch (error) {
      console.error("Failed to create pull request:", error);
      showError("Failed to create pull request");
    } finally {
      setCreating(false);
    }
  };

  if (!repository) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create Pull Request</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Alert variant="info">
            <div className="d-flex align-items-center">
              <i className="bi bi-git me-2"></i>
              <div>
                <strong>Creating PR for:</strong> {repository.full_name}<br />
                <small>From: <code>{headBranch}</code> → To: <code>{baseBranch}</code></small>
              </div>
            </div>
          </Alert>

          {/* Title */}
          <Form.Group className="mb-3">
            <Form.Label>Title <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descriptive title for your pull request"
              required
            />
          </Form.Group>

          {/* Base Branch */}
          <Form.Group className="mb-3">
            <Form.Label>Base Branch (merge into)</Form.Label>
            <Form.Select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              disabled={loadingBranches}
            >
              {loadingBranches ? (
                <option>Loading branches...</option>
              ) : (
                branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.is_default ? "(default)" : ""}
                  </option>
                ))
              )}
            </Form.Select>
          </Form.Group>

          {/* Description */}
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the changes in this pull request..."
            />
            <Form.Text className="text-muted">
              You can use Markdown formatting in the description.
            </Form.Text>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!title.trim() || creating}
          >
            {creating ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Creating PR...
              </>
            ) : (
              <>
                <i className="bi bi-git me-2"></i>
                Create Pull Request
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

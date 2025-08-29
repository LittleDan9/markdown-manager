import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubApi from '../../../api/gitHubApi';

const GitHubRepositoryBrowser = ({ show, onHide, repository }) => {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (show && repository) {
      loadBranches();
    }
  }, [show, repository]);

  useEffect(() => {
    if (selectedBranch) {
      loadFileTree();
    }
  }, [selectedBranch]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const branchData = await gitHubApi.getRepositoryBranches(repository.id);
      setBranches(branchData);
      if (branchData.length > 0) {
        setSelectedBranch(branchData[0].name); // Select first branch (usually main/master)
      }
      setError(null);
    } catch (err) {
      setError('Failed to load repository branches');
      console.error('Error loading branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFileTree = async (path = '') => {
    try {
      setLoading(true);
      const contents = await gitHubApi.getRepositoryContents(repository.id, { 
        branch: selectedBranch, 
        path 
      });
      
      if (path === '') {
        // Root level - build initial tree
        setFileTree(buildFileTree(contents));
      } else {
        // Loading subfolder - update tree
        updateFileTree(path, contents);
      }
      setError(null);
    } catch (err) {
      setError(`Failed to load repository contents${path ? ` for ${path}` : ''}`);
      console.error('Error loading file tree:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildFileTree = (contents) => {
    return contents.map(item => ({
      ...item,
      children: item.type === 'dir' ? [] : null,
      loaded: item.type === 'file'
    }));
  };

  const updateFileTree = (path, contents) => {
    // This would update the tree with new folder contents
    // Implementation depends on how we structure the tree data
    // For now, we'll rebuild the tree when folders are expanded
  };

  const toggleFolder = async (folder) => {
    const folderPath = folder.path;
    const newExpanded = new Set(expandedFolders);
    
    if (expandedFolders.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
      // Load folder contents if not already loaded
      if (!folder.loaded) {
        await loadFolderContents(folder);
      }
    }
    
    setExpandedFolders(newExpanded);
  };

  const loadFolderContents = async (folder) => {
    try {
      const contents = await gitHubApi.getRepositoryContents(repository.id, {
        branch: selectedBranch,
        path: folder.path
      });
      
      // Update the fileTree with the new contents
      // This is a simplified version - real implementation would update the tree structure
      console.log('Folder contents:', contents);
    } catch (err) {
      showError(`Failed to load folder: ${folder.name}`);
    }
  };

  const selectFile = async (file) => {
    if (file.type !== 'file') return;
    
    setSelectedFile(file);
    
    // Only load content for markdown files
    const isMarkdown = file.name.match(/\.(md|markdown)$/i);
    if (isMarkdown) {
      await loadFileContent(file);
    } else {
      setFileContent('');
    }
  };

  const loadFileContent = async (file) => {
    try {
      setContentLoading(true);
      const content = await gitHubApi.getFileContent(repository.id, file.path, selectedBranch);
      setFileContent(content);
    } catch (err) {
      showError('Failed to load file content');
      setFileContent('');
    } finally {
      setContentLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    try {
      await gitHubApi.importFile({
        repository_id: repository.id,
        file_path: selectedFile.path,
        branch: selectedBranch
      });
      
      showSuccess(`Successfully imported ${selectedFile.name}`);
      onHide();
    } catch (err) {
      showError('Failed to import file');
    }
  };

  const isMarkdownFile = (file) => {
    return file && file.type === 'file' && file.name.match(/\.(md|markdown)$/i);
  };

  const renderFileTree = (items, level = 0) => {
    return items.map(item => (
      <div key={item.path} style={{ marginLeft: `${level * 20}px` }}>
        <div 
          className={`file-tree-item p-2 ${selectedFile?.path === item.path ? 'bg-primary text-white' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => item.type === 'dir' ? toggleFolder(item) : selectFile(item)}
        >
          {item.type === 'dir' ? (
            <>
              <i className={`bi bi-${expandedFolders.has(item.path) ? 'folder-open' : 'folder'} me-2`}></i>
              {item.name}
            </>
          ) : (
            <>
              <i className={`bi bi-file-earmark${isMarkdownFile(item) ? '-text' : ''} me-2`}></i>
              {item.name}
              {isMarkdownFile(item) && <i className="bi bi-check-circle-fill text-success ms-1"></i>}
            </>
          )}
        </div>
        {item.type === 'dir' && expandedFolders.has(item.path) && item.children && (
          renderFileTree(item.children, level + 1)
        )}
      </div>
    ));
  };

  if (!repository) return null;

  return (
    <Modal show={show} onHide={onHide} size="xl" fullscreen="lg-down">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-folder-open me-2"></i>
          Browse Repository: {repository.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ height: '70vh' }}>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {/* Branch Selection */}
        <Row className="mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label>Branch</Form.Label>
              <Form.Select 
                value={selectedBranch} 
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={loading}
              >
                {branches.map(branch => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <div className="mt-2">Loading repository contents...</div>
          </div>
        ) : (
          <Row style={{ height: 'calc(100% - 80px)' }}>
            {/* File Tree - Left Pane */}
            <Col md={4} className="border-end">
              <Card className="h-100">
                <Card.Header>
                  <small>Files & Folders</small>
                </Card.Header>
                <Card.Body className="p-0" style={{ overflowY: 'auto' }}>
                  {renderFileTree(fileTree)}
                </Card.Body>
              </Card>
            </Col>

            {/* File Content - Right Pane */}
            <Col md={8}>
              <Card className="h-100">
                <Card.Header>
                  <small>
                    {selectedFile ? selectedFile.name : 'Select a file'}
                  </small>
                </Card.Header>
                <Card.Body style={{ overflowY: 'auto' }}>
                  {contentLoading ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" size="sm" />
                      <div className="mt-2">Loading file content...</div>
                    </div>
                  ) : selectedFile ? (
                    isMarkdownFile(selectedFile) ? (
                      <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>
                        {fileContent || 'No content available'}
                      </pre>
                    ) : (
                      <div className="text-muted text-center py-5">
                        <i className="bi bi-file-earmark fs-1"></i>
                        <div>Only markdown files can be previewed</div>
                      </div>
                    )
                  ) : (
                    <div className="text-muted text-center py-5">
                      <i className="bi bi-arrow-left"></i>
                      <div>Select a file to view its content</div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div className="text-muted small">
            {selectedFile && (
              <>Selected: {selectedFile.name}</>
            )}
          </div>
          <div>
            <Button variant="secondary" onClick={onHide} className="me-2">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleImport}
              disabled={!selectedFile || !isMarkdownFile(selectedFile)}
            >
              <i className="bi bi-download me-1"></i>
              Import File
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default GitHubRepositoryBrowser;

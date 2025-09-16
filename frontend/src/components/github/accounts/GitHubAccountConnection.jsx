import React, { useState, useEffect } from 'react';
import { Button, Alert, Card } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubApi from '../../../api/gitHubApi';
import githubOAuthListener from '../../../utils/GitHubOAuthListener';

export default function GitHubAccountConnection({ onSuccess }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useNotification();

  // Set up global OAuth listener
  useEffect(() => {
    console.log('GitHubAccountConnection: Setting up global OAuth listener');
    const cleanup = githubOAuthListener.addListener(handleAuthMessage);

    return cleanup; // Cleanup when component unmounts
  }, []);

  const openAuthWindow = (authUrl) => {
    console.log('Opening OAuth popup for URL:', authUrl);

    // Try a different approach: use a form with target="_blank" to preserve opener
    const popup = window.open('', 'githubAuth', 'width=600,height=600,scrollbars=yes,resizable=yes');

    if (!popup || popup.closed) {
      setError('Popup was blocked. Please allow popups for this site and try again.');
      return;
    }

    // Navigate the popup to the auth URL - this should preserve opener
    popup.location.href = authUrl;

    console.log('Popup opened and navigated successfully');
    console.log('Popup window object:', popup);

    // Listen for auth completion via postMessage
    const messageListener = (event) => {
      console.log('Received message:', event);
      handleAuthMessage(event);
    };
    window.addEventListener('message', messageListener);

    // Monitor popup status
    let checkCount = 0;
    const checkClosed = setInterval(() => {
      checkCount++;
      try {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setConnecting(false);
          console.log('Popup was closed');
        }
      } catch (e) {
        console.error('Error checking popup status:', e);
      }
    }, 1000);

    // Cleanup after 5 minutes
    setTimeout(() => {
      if (!popup.closed) {
        popup.close();
      }
      clearInterval(checkClosed);
      window.removeEventListener('message', messageListener);
      setConnecting(false);
      console.log('OAuth timeout - cleaning up');
    }, 300000);
  };

  const handleAuthMessage = (event) => {
    console.log('handleAuthMessage called with event:', event);
    console.log('Event origin:', event.origin);
    console.log('Event data:', event.data);

    // For debugging, temporarily accept all origins but log them
    const allowedOrigins = [
      'http://localhost:80',
      'http://localhost',
      'http://localhost:3000',
      'http://api.localhost:80',
      'http://api.localhost',
      'https://www.littledan.com',
      'https://littledan.com'
    ];

    if (!allowedOrigins.includes(event.origin)) {
      console.log('Origin not in allowed list, but proceeding anyway for debugging');
    }

    if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
      console.log('Received GITHUB_AUTH_SUCCESS');
      window.removeEventListener('message', handleAuthMessage);
      setConnecting(false);
      // showSuccess('GitHub account connected successfully!');
      if (onSuccess) {
        console.log('Calling onSuccess callback');
        onSuccess();
      }
    } else if (event.data.type === 'GITHUB_AUTH_ERROR') {
      console.log('Received GITHUB_AUTH_ERROR:', event.data.error);
      window.removeEventListener('message', handleAuthMessage);
      setConnecting(false);
      setError('GitHub authentication failed. Please try again.');
      showError('GitHub authentication failed');
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError('');

      // Get OAuth URL from backend
      const response = await gitHubApi.initiateConnection();
      const { authorization_url } = response;

      // Open the OAuth popup window
      openAuthWindow(authorization_url);

    } catch (error) {
      setError(error.message || 'Failed to connect to GitHub. Please try again.');
      setConnecting(false);
    }
  };

  return (
    <div className="github-account-connection">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <Card.Body className="text-center">
          <div className="mb-3">
            <i className="bi bi-github fs-1 text-primary"></i>
          </div>

          <Card.Title>Connect Your GitHub Account</Card.Title>
          <Card.Text className="text-muted mb-4">
            Connect your GitHub account to import repositories, sync documents, and collaborate on projects.
          </Card.Text>

          <Button
            variant="primary"
            size="lg"
            onClick={handleConnect}
            disabled={connecting}
            className="mb-3"
          >
            {connecting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Connecting...
              </>
            ) : (
              <>
                <i className="bi bi-github me-2"></i>
                Connect GitHub Account
              </>
            )}
          </Button>

          <div className="small text-muted">
            <p className="mb-0">
              This will allow access to your repositories and profile information.
            </p>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

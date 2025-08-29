import React, { useState } from 'react';
import { Button, Alert, Card } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import gitHubApi from '../../../api/gitHubApi';

export default function GitHubAccountConnection({ onSuccess }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useNotification();

  const openAuthWindow = (authUrl) => {
    console.log('=== OPENING AUTH WINDOW ===');
    console.log('Auth URL:', authUrl);
    
    // Open GitHub OAuth in new window
    const popup = window.open(authUrl, 'githubAuth', 'width=600,height=600');
    console.log('Popup window opened:', popup);
    
    // Check if popup was blocked
    if (!popup || popup.closed) {
      console.error('Popup was blocked or failed to open');
      setError('Popup was blocked. Please allow popups for this site and try again.');
      return;
    }
    
    // Listen for auth completion
    console.log('Adding message event listener');
    window.addEventListener('message', handleAuthMessage);
    console.log('Event listener added');
    
    // Monitor popup status
    let checkCount = 0;
    const checkClosed = setInterval(() => {
      checkCount++;
      try {
        if (popup.closed) {
          console.log(`Popup was closed after ${checkCount} seconds`);
          clearInterval(checkClosed);
          window.removeEventListener('message', handleAuthMessage);
          setConnecting(false);
        } else {
          // Try to check popup location for debugging
          try {
            console.log(`Check ${checkCount}: Popup URL:`, popup.location.href);
          } catch (e) {
            // Expected for cross-origin, just log that we're checking
            console.log(`Check ${checkCount}: Popup still open (cross-origin)`);
          }
        }
      } catch (e) {
        console.error('Error checking popup status:', e);
      }
    }, 1000);
    
    // Cleanup after 5 minutes
    setTimeout(() => {
      if (!popup.closed) {
        console.log('Closing popup after timeout');
        popup.close();
      }
      clearInterval(checkClosed);
      window.removeEventListener('message', handleAuthMessage);
      setConnecting(false);
    }, 300000);
  };

  const handleAuthMessage = (event) => {
    console.log('=== AUTH MESSAGE RECEIVED ===');
    console.log('Event:', event);
    console.log('Origin:', event.origin);
    console.log('Data:', event.data);
    console.log('Current window origin:', window.location.origin);
    
    // For debugging, temporarily accept all origins but log them
    const allowedOrigins = [
      'http://localhost:80',
      'http://localhost',
      'http://localhost:3000',
      'http://api.localhost:80',
      'http://api.localhost'
    ];
    
    if (!allowedOrigins.includes(event.origin)) {
      console.warn('Origin not in allowed list:', event.origin, 'vs allowed:', allowedOrigins);
      console.log('Proceeding anyway for debugging...');
    }
    
    console.log('Message data:', event.data);
    
    if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
      console.log('GitHub auth success received');
      window.removeEventListener('message', handleAuthMessage);
      setConnecting(false);
      showSuccess('GitHub account connected successfully!');
      if (onSuccess) {
        console.log('Calling onSuccess callback');
        onSuccess();
      }
    } else if (event.data.type === 'GITHUB_AUTH_ERROR') {
      console.log('GitHub auth error received');
      window.removeEventListener('message', handleAuthMessage);
      setConnecting(false);
      setError('GitHub authentication failed. Please try again.');
      showError('GitHub authentication failed');
    }
  };

  const handleConnect = async () => {
    try {
      console.log('[GitHub OAuth] Starting connection process...');
      setConnecting(true);
      setError('');

      // Get OAuth URL from backend
      const response = await gitHubApi.initiateConnection();
      const { authorization_url } = response;
      console.log('[GitHub OAuth] Opening popup with URL:', authorization_url);

      // Open the OAuth popup window
      openAuthWindow(authorization_url);

    } catch (error) {
      console.error('[GitHub OAuth] Error during connection:', error);
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

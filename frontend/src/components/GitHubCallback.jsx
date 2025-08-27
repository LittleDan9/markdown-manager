import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gitHubApi from '../../api/gitHubApi';

const GitHubCallback = () => {
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code) {
        try {
          // Store in sessionStorage for parent window
          sessionStorage.setItem('github_oauth_code', code);
          sessionStorage.setItem('github_oauth_state', state || '');

          // If this is a popup, close it
          if (window.opener) {
            window.close();
          } else {
            // If not a popup, redirect to settings
            window.location.href = '/#settings?tab=github';
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          sessionStorage.setItem('github_oauth_error', 'Failed to process OAuth callback');
          if (window.opener) {
            window.close();
          }
        }
      }
    };

    handleCallback();
  }, [location]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#f8f9fa'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h3>Processing GitHub Connection...</h3>
        <p>This window will close automatically.</p>
      </div>
    </div>
  );
};

export default GitHubCallback;

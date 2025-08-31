import { useEffect } from 'react';
import { useNotification } from '@/components/NotificationProvider';

/**
 * Hook to handle GitHub OAuth results from URL parameters
 * This provides a fallback mechanism when popup-based OAuth fails
 * and the OAuth success/error pages redirect to the main app with parameters
 */
export function useGitHubOAuth() {
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const githubOAuth = urlParams.get('github_oauth');
    
    if (githubOAuth === 'success') {
      showSuccess('GitHub account connected successfully!');
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (githubOAuth === 'error') {
      const errorMessage = urlParams.get('github_error') || 'GitHub authentication failed';
      showError(`GitHub authentication failed: ${errorMessage}`);
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showSuccess, showError]);
}

import { useEffect } from 'react';
import { useNotification } from '@/components/NotificationProvider';

/**
 * Hook to handle GitHub OAuth results from URL parameters
 * This provides a fallback mechanism when popup-based OAuth fails
 * and the OAuth success/error pages redirect to the main app with parameters
 */
export const useGitHubOAuth = () => {
    const { showSuccess, showError } = useNotification();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('github_oauth')) {
            const status = urlParams.get('github_oauth');

            // Only handle URL parameters if we're NOT in a popup scenario
            // (i.e., this is a fallback redirect from a tab-based OAuth)
            const isPopupScenario = window.opener !== null;

            if (!isPopupScenario) {
                if (status === 'success') {
                    showSuccess('GitHub account connected successfully!');
                } else if (status === 'error') {
                    const _error = urlParams.get('error');
                    const errorDescription = urlParams.get('error_description');
                    const message = errorDescription ?
                        `GitHub connection failed: ${errorDescription}` :
                        'GitHub connection failed';

                    showError(message);
                }
            }

            // Always clean up URL parameters
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('github_oauth');
            newUrl.searchParams.delete('error');
            newUrl.searchParams.delete('error_description');
            window.history.replaceState({}, document.title, newUrl);
        }
    }, [showSuccess, showError]);
};

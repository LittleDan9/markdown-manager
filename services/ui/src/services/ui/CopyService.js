/**
 * CopyService - Handles copying text to clipboard with visual feedback
 */

class CopyService {
  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - Button element that triggered the copy (optional)
   * @returns {Promise<boolean>} - Success status
   */
  static async copyToClipboard(text, button = null) {
    try {
      await navigator.clipboard.writeText(text);
      
      // Add visual feedback to the button
      if (button) {
        this.showCopyFeedback(button);
      }
      
      return true;
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      
      // Fallback for older browsers
      return this.fallbackCopy(text, button);
    }
  }

  /**
   * Show visual feedback on copy button
   * @param {HTMLElement} button - Button element
   */
  static showCopyFeedback(button) {
    // Find the icon element inside the button
    const icon = button.querySelector('i.bi-clipboard');
    if (icon) {
      // Add transition for smooth animation
      icon.style.transition = 'opacity 0.3s ease-in-out';
      
      // Fade out current icon
      icon.style.opacity = '0';
      
      setTimeout(() => {
        // Change to check icon and success color
        icon.classList.remove('bi-clipboard');
        icon.classList.add('bi-clipboard-check', 'text-success');
        
        // Fade in the new icon
        icon.style.opacity = '1';
        
        // Revert back after longer delay (4 seconds)
        setTimeout(() => {
          // Fade out success icon
          icon.style.opacity = '0';
          
          setTimeout(() => {
            // Change back to original icon and remove success color
            icon.classList.remove('bi-clipboard-check', 'text-success');
            icon.classList.add('bi-clipboard');
            
            // Fade in original icon
            icon.style.opacity = '1';
            
            // Remove transition after animation completes
            setTimeout(() => {
              icon.style.transition = '';
            }, 300);
          }, 300);
        }, 4000);
      }, 300);
    }
  }

  /**
   * Fallback copy method for older browsers
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - Button element (optional)
   * @returns {boolean} - Success status
   */
  static fallbackCopy(text, button = null) {
    try {
      // Create a temporary textarea element
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      
      document.body.appendChild(textarea);
      textarea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (success && button) {
        this.showCopyFeedback(button);
      }
      
      return success;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    }
  }

  /**
   * Extract code content from a code block element
   * @param {HTMLElement} codeBlock - Code block container element
   * @returns {string} - Code content
   */
  static extractCodeContent(codeBlock) {
    // Try to get from data attribute first (encoded content)
    const preElement = codeBlock.querySelector('pre[data-code]');
    if (preElement && preElement.dataset.code) {
      try {
        return decodeURIComponent(preElement.dataset.code);
      } catch (err) {
        console.warn('Failed to decode code from data attribute:', err);
      }
    }

    // Fallback to text content
    const codeElement = codeBlock.querySelector('code');
    if (codeElement) {
      return codeElement.textContent || codeElement.innerText || '';
    }

    return '';
  }

  /**
   * Setup click handlers for copy buttons in a container
   * @param {HTMLElement} container - Container element to search for copy buttons
   * @param {Function} notificationCallback - Optional callback for notifications
   */
  static setupCopyHandlers(container, notificationCallback = null) {
    if (!container) return;

    // Find all copy buttons
    const copyButtons = container.querySelectorAll('[data-prismjs-copy]');
    
    copyButtons.forEach(button => {
      // Remove existing listeners to prevent duplicates
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Add click handler
      newButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Find the parent code block
        const codeBlock = newButton.closest('.code-block');
        if (!codeBlock) {
          console.warn('Copy button not inside a code block');
          return;
        }

        // Extract the code content
        const codeContent = this.extractCodeContent(codeBlock);
        if (!codeContent) {
          console.warn('No code content found to copy');
          return;
        }

        // Copy to clipboard
        const success = await this.copyToClipboard(codeContent, newButton);
        
        // Show notification only for errors (success is shown via icon change)
        if (notificationCallback && !success) {
          notificationCallback('Failed to copy code to clipboard', 'error');
        }
      });
    });
  }

  /**
   * Remove copy handlers from a container
   * @param {HTMLElement} container - Container element
   */
  static removeCopyHandlers(container) {
    if (!container) return;

    const copyButtons = container.querySelectorAll('[data-prismjs-copy]');
    copyButtons.forEach(button => {
      // Clone and replace to remove all event listeners
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
    });
  }
}

export default CopyService;

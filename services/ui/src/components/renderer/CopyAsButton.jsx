import React, { useState, useCallback } from 'react';
import { Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import CopyService from '../../services/ui/CopyService';
import { useNotification } from '../NotificationProvider';

const CopyAsButton = ({ previewHTML, markdownContent }) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const { showSuccess: notifySuccess } = useNotification();
  const supportsRich = CopyService.supportsRichCopy();

  const getPlainText = useCallback(() => {
    if (!previewHTML) return '';
    const temp = document.createElement('div');
    temp.innerHTML = previewHTML;
    return temp.textContent || temp.innerText || '';
  }, [previewHTML]);

  const handleCopyRichText = useCallback(async () => {
    if (!previewHTML) return;
    const plainText = getPlainText();
    const success = await CopyService.copyAsRichText(previewHTML, plainText);
    if (success) {
      setShowSuccess(true);
      notifySuccess('Copied as rich text');
      setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [previewHTML, getPlainText, notifySuccess]);

  const handleCopyPlainText = useCallback(async () => {
    const plainText = getPlainText();
    if (!plainText) return;
    const success = await CopyService.copyToClipboard(plainText);
    if (success) {
      setShowSuccess(true);
      notifySuccess('Copied as plain text');
      setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [getPlainText, notifySuccess]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!markdownContent) return;
    const success = await CopyService.copyToClipboard(markdownContent);
    if (success) {
      setShowSuccess(true);
      notifySuccess('Copied as Markdown');
      setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [markdownContent, notifySuccess]);

  if (!previewHTML && !markdownContent) return null;

  return (
    <div className="copy-as-button">
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="link"
          size="sm"
          className={`copy-as-toggle ${showSuccess ? 'copy-success' : ''}`}
          id="copy-as-dropdown"
        >
          <i className={`bi ${showSuccess ? 'bi-clipboard-check' : 'bi-clipboard'}`}></i>
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <Dropdown.Header>Copy As</Dropdown.Header>
          {supportsRich ? (
            <Dropdown.Item onClick={handleCopyRichText}>
              <i className="bi bi-file-richtext me-2"></i>Rich Text
            </Dropdown.Item>
          ) : (
            <OverlayTrigger
              placement="left"
              overlay={
                <Tooltip id="rich-copy-tooltip">
                  Rich text copy requires Chrome, Edge, or Safari
                </Tooltip>
              }
            >
              <span className="d-inline-block w-100">
                <Dropdown.Item disabled style={{ pointerEvents: 'none' }}>
                  <i className="bi bi-file-richtext me-2"></i>Rich Text
                </Dropdown.Item>
              </span>
            </OverlayTrigger>
          )}
          <Dropdown.Item onClick={handleCopyPlainText}>
            <i className="bi bi-file-text me-2"></i>Plain Text
          </Dropdown.Item>
          <Dropdown.Item onClick={handleCopyMarkdown} disabled={!markdownContent}>
            <i className="bi bi-markdown me-2"></i>Markdown
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default CopyAsButton;

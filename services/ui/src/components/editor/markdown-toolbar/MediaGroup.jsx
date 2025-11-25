import React, { useState, useEffect } from 'react';
import { Button, ButtonGroup, Dropdown, DropdownButton } from 'react-bootstrap';
import ImageBrowserModal from '@/components/images/ImageBrowserModal';
import ImageUploadModal from '@/components/images/ImageUploadModal';
import { useImageManagement } from '@/hooks/image/useImageManagement';

/**
 * Media and Links toolbar group (Link, Image, Quote, Horizontal Rule) - responsive version
 * Shows individual buttons on wider screens, dropdown on narrow screens
 */
export function MediaGroup({ insertMarkdown, insertHorizontalRule, buttonVariant, buttonStyle, editorRef }) {
  const [useDropdown, setUseDropdown] = useState(false);
  const [showImageBrowser, setShowImageBrowser] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const { generateMarkdown } = useImageManagement();

  // Check container width to determine if we should use dropdown
  useEffect(() => {
    const checkWidth = () => {
      const toolbar = document.querySelector('.markdown-toolbar');
      if (toolbar) {
        const toolbarWidth = toolbar.offsetWidth;
        // Switch to dropdown if toolbar width is less than 500px (earlier than headings)
        setUseDropdown(toolbarWidth < 500);
      }
    };

    // Initial check
    checkWidth();

    // Listen for window resize
    window.addEventListener('resize', checkWidth);

    // Use ResizeObserver for more accurate toolbar width changes
    let observer;
    const toolbar = document.querySelector('.markdown-toolbar');
    if (toolbar && window.ResizeObserver) {
      observer = new ResizeObserver(checkWidth);
      observer.observe(toolbar);
    }

    return () => {
      window.removeEventListener('resize', checkWidth);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  const handleImageSelected = (image) => {
    if (image && editorRef?.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const markdown = generateMarkdown(image, 'Image', '');
      
      if (selection) {
        // Replace selected text or insert at cursor
        editor.executeEdits('insert-image', [{
          range: selection,
          text: markdown
        }]);
      }
      
      // Focus back to editor
      editor.focus();
    }
  };

  const handleImageUploaded = (image) => {
    // Automatically insert uploaded image
    handleImageSelected(image);
  };

  const insertImageMarkdown = () => {
    insertMarkdown('![', '](image-url)', 'alt text');
  };

  if (useDropdown) {
    return (
      <>
        <DropdownButton
          as={ButtonGroup}
          id="media-dropdown"
          title={<i className="bi bi-paperclip"></i>}
          variant={buttonVariant}
          size="sm"
          style={{
            ...buttonStyle,
            height: '27px',
            display: 'flex',
            alignItems: 'center'
          }}
          className="media-dropdown"
        >
          <Dropdown.Item onClick={() => insertMarkdown('[', '](url)', 'link text')}>
            <i className="bi bi-link-45deg me-2"></i>
            <strong>Link</strong>
          </Dropdown.Item>
          <Dropdown.Item onClick={() => setShowImageBrowser(true)}>
            <i className="bi bi-images me-2"></i>
            <strong>Browse Images</strong>
          </Dropdown.Item>
          <Dropdown.Item onClick={() => setShowImageUpload(true)}>
            <i className="bi bi-upload me-2"></i>
            <strong>Upload Image</strong>
          </Dropdown.Item>
          <Dropdown.Item onClick={insertImageMarkdown}>
            <i className="bi bi-image me-2"></i>
            <strong>Image URL</strong>
          </Dropdown.Item>
          <Dropdown.Item onClick={() => insertMarkdown('> ', '', 'quote text')}>
            <i className="bi bi-quote me-2"></i>
            <strong>Quote</strong>
          </Dropdown.Item>
          <Dropdown.Item onClick={insertHorizontalRule}>
            <i className="bi bi-dash-lg me-2"></i>
            <strong>Horizontal Rule</strong>
          </Dropdown.Item>
        </DropdownButton>

        {/* Image Modals */}
        <ImageBrowserModal
          show={showImageBrowser}
          onHide={() => setShowImageBrowser(false)}
          onImageSelected={handleImageSelected}
          allowMultiple={false}
        />
        
        <ImageUploadModal
          show={showImageUpload}
          onHide={() => setShowImageUpload(false)}
          onImageUploaded={handleImageUploaded}
        />
      </>
    );
  }

  return (
    <>
      <ButtonGroup size="sm">
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('[', '](url)', 'link text')}
          title="Link"
        >
          <i className="bi bi-link-45deg"></i>
        </Button>
        
        {/* Image dropdown */}
        <DropdownButton
          as={ButtonGroup}
          id="image-dropdown"
          title={<i className="bi bi-image"></i>}
          variant={buttonVariant}
          size="sm"
          style={buttonStyle}
        >
          <Dropdown.Item onClick={() => setShowImageBrowser(true)}>
            <i className="bi bi-images me-2"></i>
            Browse Images
          </Dropdown.Item>
          <Dropdown.Item onClick={() => setShowImageUpload(true)}>
            <i className="bi bi-upload me-2"></i>
            Upload Image
          </Dropdown.Item>
          <Dropdown.Item onClick={insertImageMarkdown}>
            <i className="bi bi-link-45deg me-2"></i>
            Image URL
          </Dropdown.Item>
        </DropdownButton>
        
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={() => insertMarkdown('> ', '', 'quote text')}
          title="Quote"
        >
          <i className="bi bi-quote"></i>
        </Button>
        <Button
          variant={buttonVariant}
          style={buttonStyle}
          onClick={insertHorizontalRule}
          title="Horizontal Rule"
        >
          <i className="bi bi-dash-lg"></i>
        </Button>
      </ButtonGroup>

      {/* Image Modals */}
      <ImageBrowserModal
        show={showImageBrowser}
        onHide={() => setShowImageBrowser(false)}
        onImageSelected={handleImageSelected}
        allowMultiple={false}
      />
      
      <ImageUploadModal
        show={showImageUpload}
        onHide={() => setShowImageUpload(false)}
        onImageUploaded={handleImageUploaded}
      />
    </>
  );
}

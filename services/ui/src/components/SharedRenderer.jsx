import React, { useState, useEffect } from 'react';
import { render } from '@/services/rendering';

const SharedRenderer = ({ content }) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (content) {
      try {
        const htmlString = render(content);
        setHtml(htmlString);
      } catch (error) {
        console.error('Failed to render markdown:', error);
        setHtml('<p>Error rendering content</p>');
      }
    } else {
      setHtml('');
    }
  }, [content]);

  return (
    <div 
      className="shared-document-content"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        lineHeight: '1.6',
        fontSize: '16px',
        maxWidth: 'none',
        color: 'inherit'
      }}
    />
  );
};

export default SharedRenderer;

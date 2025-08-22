import React from 'react';
import { useMarkdownActions, useToolbarStyling } from '../hooks/markdown';
import { TextFormattingGroup } from './markdown-toolbar/TextFormattingGroup';
import { HeadingGroup } from './markdown-toolbar/HeadingGroup';
import { ListGroup } from './markdown-toolbar/ListGroup';
import { MediaGroup } from './markdown-toolbar/MediaGroup';
import { ToolbarSeparator } from './markdown-toolbar/ToolbarSeparator';

const MarkdownToolbar = ({ editorRef }) => {
  const { insertMarkdown, insertHeading, insertList, insertHorizontalRule } = useMarkdownActions(editorRef);
  const { styles, buttonVariant } = useToolbarStyling();

  return (
    <div className="markdown-toolbar d-flex align-items-center gap-2" style={styles.toolbar}>
      {/* Text Formatting */}
      <TextFormattingGroup
        insertMarkdown={insertMarkdown}
        buttonVariant={buttonVariant}
        buttonStyle={styles.button}
      />

      <ToolbarSeparator style={styles.separator} />

      {/* Headings */}
      <HeadingGroup
        insertHeading={insertHeading}
        buttonVariant={buttonVariant}
        buttonStyle={styles.button}
      />

      <ToolbarSeparator style={styles.separator} />

      {/* Lists */}
      <ListGroup
        insertList={insertList}
        buttonVariant={buttonVariant}
        buttonStyle={styles.button}
      />

      <ToolbarSeparator style={styles.separator} />

      {/* Links & Media */}
      <MediaGroup
        insertMarkdown={insertMarkdown}
        insertHorizontalRule={insertHorizontalRule}
        buttonVariant={buttonVariant}
        buttonStyle={styles.button}
      />
    </div>
  );
};

export default MarkdownToolbar;

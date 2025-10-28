import React from 'react';
import { useMarkdownActions, useToolbarStyling } from '@/hooks/markdown';
import {
  TextFormattingGroup,
  HeadingGroup,
  ListGroup,
  MediaGroup,
  SpellCheckGroup,
  ToolbarSeparator
} from './markdown-toolbar';

const MarkdownToolbar = ({
  editorRef,
  onSpellCheck,
  spellCheckProgress,
  onMarkdownLint,
  markdownLintProgress,
  // Phase 5: New props for advanced spell check features
  onSpellCheckSettings = () => {},
  spellCheckSettings = {},
  readabilityData = null,
  serviceInfo = null
}) => {
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
        editorRef={editorRef}
      />

      <ToolbarSeparator style={styles.separator} />

      {/* Analysis Tools - Spell Check & Markdown Lint */}
      <SpellCheckGroup
        onSpellCheck={onSpellCheck}
        onMarkdownLint={onMarkdownLint}
        buttonVariant={buttonVariant}
        buttonStyle={styles.button}
        spellCheckProgress={spellCheckProgress}
        markdownLintProgress={markdownLintProgress}
        // Phase 5: Pass new props
        onSpellCheckSettings={onSpellCheckSettings}
        spellCheckSettings={spellCheckSettings}
        readabilityData={readabilityData}
        serviceInfo={serviceInfo}
      />
    </div>
  );
};

export default MarkdownToolbar;

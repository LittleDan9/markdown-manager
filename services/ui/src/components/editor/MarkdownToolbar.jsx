import React from 'react';
import { Button } from 'react-bootstrap';
import { useMarkdownActions, useToolbarStyling } from '@/hooks/markdown';
import { useDocumentContext } from '@/providers/DocumentContextProvider';
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
  serviceInfo = null,
  // Outline toggle
  onToggleOutline,
  outlineVisible = false,
  hasOutlineHeadings = false,
  // Comments toggle
  onToggleComments,
  commentsVisible = false,
  commentCount = 0
}) => {
  const { insertMarkdown, insertHeading, insertList, insertHorizontalRule } = useMarkdownActions(editorRef);
  const { styles, buttonVariant } = useToolbarStyling();
  const { setShowIconBrowser } = useDocumentContext();

  return (
    <div className="markdown-toolbar d-flex align-items-center gap-1 flex-wrap" style={styles.toolbar}>
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

      <ToolbarSeparator style={styles.separator} />

      {/* Icon Browser for Mermaid diagrams */}
      <Button
        variant={buttonVariant}
        size="sm"
        style={styles.button}
        onClick={() => setShowIconBrowser(true)}
        title="Browse AWS Icons for Mermaid"
      >
        <i className="bi bi-grid-3x3-gap" />
      </Button>

      {onToggleOutline && (
        <>
          <ToolbarSeparator style={styles.separator} />
          <Button
            variant={outlineVisible ? 'primary' : buttonVariant}
            size="sm"
            style={outlineVisible ? undefined : styles.button}
            onClick={onToggleOutline}
            title="Toggle document outline"
            disabled={!hasOutlineHeadings}
          >
            <i className="bi bi-list-nested" />
          </Button>
        </>
      )}

      {onToggleComments && (
        <>
          <ToolbarSeparator style={styles.separator} />
          <Button
            variant={commentsVisible ? 'primary' : buttonVariant}
            size="sm"
            style={commentsVisible ? undefined : styles.button}
            onClick={onToggleComments}
            title="Toggle comments"
            className="position-relative"
          >
            <i className="bi bi-chat-left-text" />
            {commentCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.55em' }}>
                {commentCount}
              </span>
            )}
          </Button>
        </>
      )}
    </div>
  );
};

export default MarkdownToolbar;

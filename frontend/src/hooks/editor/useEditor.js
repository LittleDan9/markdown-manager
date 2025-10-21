import useEditorCore from './useEditorCore';
import useEditorSpellCheck from './useEditorSpellCheck';
import useEditorMarkdownLint from './useEditorMarkdownLint';
import useEditorKeyboardShortcuts from './useEditorKeyboardShortcuts';
import useEditorListBehavior from './useEditorListBehavior';

/**
 * Main orchestrating editor hook that composes all domain-specific hooks
 * Maintains backwards compatibility with the original useEditor API
 * @param {Object} config - Configuration object
 * @returns {Object} Complete editor interface
 */
export default function useEditor({
  containerRef,
  value,
  onChange,
  onCursorLineChange,
  enableSpellCheck = true,
  enableMarkdownLint = true,
  enableKeyboardShortcuts = true,
  enableListBehavior = true,
  categoryId,
  getCategoryId,
  getFolderPath,
  
  // Support for new config object approach (for future)
  config
}) {
  // If config object is provided, merge with individual props
  const finalConfig = config ? {
    spellCheck: { enabled: enableSpellCheck, ...(config.spellCheck || {}) },
    markdownLint: { enabled: enableMarkdownLint, ...(config.markdownLint || {}) },
    keyboardShortcuts: { enabled: enableKeyboardShortcuts, ...(config.keyboardShortcuts || {}) },
    listBehavior: { enabled: enableListBehavior, ...(config.listBehavior || {}) }
  } : {
    spellCheck: { enabled: enableSpellCheck },
    markdownLint: { enabled: enableMarkdownLint },
    keyboardShortcuts: { enabled: enableKeyboardShortcuts },
    listBehavior: { enabled: enableListBehavior }
  };

  // Core editor setup
  const { editor, isTyping, markAsTyping } = useEditorCore({
    containerRef,
    value,
    onChange,
    onCursorLineChange
  });

  // Spell check functionality
  const spellCheckResult = useEditorSpellCheck(
    editor,
    finalConfig.spellCheck.enabled,
    categoryId,
    getFolderPath
  );

  // Markdown linting functionality
  const markdownLintResult = useEditorMarkdownLint(
    editor,
    finalConfig.markdownLint.enabled,
    categoryId,
    getFolderPath
  );

  // List behavior
  useEditorListBehavior(editor, finalConfig.listBehavior.enabled);

  // Keyboard shortcuts (depends on other hooks' trigger functions)
  useEditorKeyboardShortcuts(
    editor,
    finalConfig.keyboardShortcuts.enabled,
    spellCheckResult.suggestionsMap,
    markdownLintResult.markersMap,
    getCategoryId,
    getFolderPath,
    spellCheckResult.triggerSpellCheck,
    markdownLintResult.triggerMarkdownLint
  );

  // Return interface compatible with original useEditor
  return {
    editor,
    
    // Spell check interface (only if enabled)
    spellCheck: finalConfig.spellCheck.enabled ? {
      progress: spellCheckResult.progress,
      suggestionsMap: spellCheckResult.suggestionsMap
    } : undefined,
    
    // Markdown lint interface (only if enabled)
    markdownLint: finalConfig.markdownLint.enabled ? {
      lintProgress: markdownLintResult.lintProgress,
      markersMap: markdownLintResult.markersMap
    } : undefined,
    
    // Manual trigger functions
    runSpellCheck: spellCheckResult.runSpellCheck,
    runMarkdownLint: markdownLintResult.runMarkdownLint,
    
    // External trigger functions (for services)
    triggerSpellCheck: spellCheckResult.triggerSpellCheck,
    triggerMarkdownLint: markdownLintResult.triggerMarkdownLint
  };
}
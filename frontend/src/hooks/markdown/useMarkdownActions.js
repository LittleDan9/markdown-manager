import { useTextFormatting } from './useTextFormatting';
import { useHeadingInsertion } from './useHeadingInsertion';
import { useListInsertion } from './useListInsertion';
import { useHorizontalRuleInsertion } from './useHorizontalRuleInsertion';

/**
 * Composed hook that combines all markdown insertion functionality
 * This is the main hook that components should use
 */
export function useMarkdownActions(editorRef) {
  const { insertMarkdown } = useTextFormatting(editorRef);
  const { insertHeading } = useHeadingInsertion(editorRef);
  const { insertList } = useListInsertion(editorRef);
  const { insertHorizontalRule } = useHorizontalRuleInsertion(editorRef);

  return {
    insertMarkdown,
    insertHeading,
    insertList,
    insertHorizontalRule
  };
}

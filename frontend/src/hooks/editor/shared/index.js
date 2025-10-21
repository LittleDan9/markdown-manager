// Barrel export for shared utilities - includes list indentation functions
export { useTypingDetection, useDebounce } from './useTypingDetection';
export {
  isInCodeFence,
  getListPattern,
  analyzeOrderedListPattern,
  getIndentationLevel,
  createIndentation,
  isListItemOrConvertible,
  convertToListItem,
  increaseListIndentation,
  decreaseListIndentation,
  findPreviousIndentationLevel
} from './editorUtils';
/**
 * Tour step definitions for the GuidedTour component.
 * Each step targets an existing DOM element by CSS selector.
 */
const tourSteps = [
  {
    target: '#fileMenuDropdown',
    content: 'The File menu lets you create, open, save, import, and export documents. You can also access recent files here.',
    title: 'File Menu',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.markdown-toolbar',
    content: 'The formatting toolbar gives you one-click access to bold, italic, headings, lists, links, images, and more — just like a word processor.',
    title: 'Formatting Toolbar',
    placement: 'bottom',
  },
  {
    target: '#editorContainer',
    content: 'This is the Monaco-powered editor. Write your markdown here with full syntax highlighting, autocomplete, and spell check support.',
    title: 'Editor',
    placement: 'right',
  },
  {
    target: '#preview',
    content: 'The live preview renders your markdown in real time — including Mermaid diagrams, math equations, and syntax-highlighted code blocks.',
    title: 'Live Preview',
    placement: 'left',
  },
  {
    target: '.semantic-search-wrapper',
    content: 'Semantic search finds documents by meaning, not just keywords. Type a question or phrase to discover relevant content across your library.',
    title: 'Semantic Search',
    placement: 'bottom',
  },
  {
    target: '#chatBtn',
    content: 'Open the AI Chat to ask questions about your documents. The AI can summarize, explain, compare, and even help you write.',
    title: 'AI Chat',
    placement: 'bottom',
  },
  {
    target: '#userDropdown',
    content: 'Access your settings, GitHub integration, image manager, theme toggle, and the Help menu from your user profile.',
    title: 'User Menu',
    placement: 'bottom-end',
  },
];

export default tourSteps;

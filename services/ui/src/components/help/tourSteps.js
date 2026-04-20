/**
 * Tour step definitions for the GuidedTour component.
 * Each step targets an existing DOM element by CSS selector.
 * All beacons disabled — continuous tour flows step-by-step.
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
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#editorContainer',
    content: 'This is the Monaco-powered editor. Write your markdown here with full syntax highlighting, autocomplete, and spell check support.',
    title: 'Editor',
    disableBeacon: true,
    placement: 'right',
  },
  {
    target: '#preview',
    content: 'The live preview renders your markdown in real time — including Mermaid diagrams, math equations, and syntax-highlighted code blocks.',
    title: 'Live Preview',
    disableBeacon: true,
    placement: 'left',
  },
  {
    target: '.category-tab-bar',
    content: 'Category tabs show documents in the same category. Click a tab to switch documents quickly, or use the + button to create a new one.',
    title: 'Category Tabs',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.semantic-search-wrapper',
    content: 'Semantic search finds documents by meaning, not just keywords. Type a question or phrase to discover relevant content across your library.',
    title: 'Semantic Search',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#chatBtn',
    content: 'Open the AI Chat to ask questions about your documents. The AI can summarize, explain, compare, and even help you write.',
    title: 'AI Chat',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#fullScreenBtn',
    content: 'Toggle fullscreen preview to focus on reading. You can also pop the preview out into a separate window.',
    title: 'Preview Controls',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#userDropdown',
    content: 'Access your settings, GitHub integration, image manager, theme toggle, and the Help menu from your user profile.',
    title: 'User Menu',
    disableBeacon: true,
    placement: 'bottom-end',
  },
];

export default tourSteps;

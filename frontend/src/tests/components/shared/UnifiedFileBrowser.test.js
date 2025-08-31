/**
 * Unit tests for UnifiedFileBrowser component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../../../src/providers/ThemeProvider';
import UnifiedFileBrowser from '../../../src/components/shared/FileBrowser/UnifiedFileBrowser';
import { LocalDocumentsProvider } from '../../../src/services/FileBrowserProviders';
import { NODE_TYPES, SOURCE_TYPES } from '../../../src/types/FileBrowserTypes';

// Mock the theme provider
const MockThemeProvider = ({ children }) => (
  <ThemeProvider value={{ theme: 'light' }}>
    {children}
  </ThemeProvider>
);

// Mock file icons utility
jest.mock('../../../src/utils/fileIcons', () => ({
  getFileIcon: jest.fn().mockReturnValue('file-text'),
  getFileIconColor: jest.fn().mockReturnValue('text-primary')
}));

// Mock github utils
jest.mock('../../../src/utils/githubUtils', () => ({
  sortRepositoryItems: jest.fn().mockImplementation(items => items),
  getEmptyState: jest.fn().mockReturnValue({
    icon: 'bi-folder-x',
    message: 'No files found'
  }),
  formatFileSize: jest.fn().mockReturnValue('1 KB'),
  isMarkdownFile: jest.fn().mockReturnValue(true)
}));

// Mock data provider
const createMockProvider = (treeData = [], pathFiles = []) => ({
  getTreeStructure: jest.fn().mockResolvedValue(treeData),
  getFilesInPath: jest.fn().mockResolvedValue(pathFiles),
  getFileContent: jest.fn().mockResolvedValue('Mock file content'),
  getDisplayName: jest.fn().mockReturnValue('Mock Provider')
});

// Sample test data
const mockTreeData = [
  {
    id: 'folder1',
    name: 'Documents',
    type: NODE_TYPES.FOLDER,
    path: '/Documents',
    source: SOURCE_TYPES.LOCAL,
    children: [
      {
        id: 'file1',
        name: 'test.md',
        type: NODE_TYPES.FILE,
        path: '/Documents/test.md',
        source: SOURCE_TYPES.LOCAL
      }
    ]
  }
];

const mockFiles = [
  {
    id: 'file1',
    name: 'test.md',
    type: NODE_TYPES.FILE,
    path: '/Documents/test.md',
    source: SOURCE_TYPES.LOCAL,
    size: 1024,
    lastModified: new Date('2024-01-01')
  }
];

describe('UnifiedFileBrowser', () => {
  const renderWithProvider = (component) => {
    return render(
      <MockThemeProvider>
        {component}
      </MockThemeProvider>
    );
  };

  test('renders without crashing', () => {
    const mockProvider = createMockProvider();
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    expect(screen.getByText('Files and folders')).toBeInTheDocument();
  });

  test('loads tree structure on mount', async () => {
    const mockProvider = createMockProvider(mockTreeData, mockFiles);
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    await waitFor(() => {
      expect(mockProvider.getTreeStructure).toHaveBeenCalled();
      expect(mockProvider.getFilesInPath).toHaveBeenCalledWith('/');
    });
  });

  test('displays loading state', () => {
    const mockProvider = createMockProvider();
    mockProvider.getTreeStructure.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('displays error state', async () => {
    const mockProvider = createMockProvider();
    mockProvider.getTreeStructure.mockRejectedValue(new Error('Failed to load'));
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load file structure')).toBeInTheDocument();
    });
  });

  test('calls onFileSelect when file is clicked', async () => {
    const mockProvider = createMockProvider(mockTreeData, mockFiles);
    const onFileSelect = jest.fn();
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={onFileSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('test.md'));
    
    expect(onFileSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test.md',
        type: NODE_TYPES.FILE
      })
    );
  });

  test('navigates to folder when folder is clicked', async () => {
    const mockProvider = createMockProvider(mockTreeData, mockFiles);
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Documents'));
    
    await waitFor(() => {
      expect(mockProvider.getFilesInPath).toHaveBeenCalledWith('/Documents');
    });
  });

  test('shows preview when file is selected', async () => {
    const mockProvider = createMockProvider(mockTreeData, mockFiles);
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
        config={{ showPreview: true }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('test.md'));
    
    await waitFor(() => {
      expect(mockProvider.getFileContent).toHaveBeenCalled();
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  test('handles multi-select mode', async () => {
    const mockProvider = createMockProvider(mockTreeData, mockFiles);
    const onMultiSelect = jest.fn();
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
        onMultiSelect={onMultiSelect}
        config={{ allowMultiSelect: true }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.md')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(onMultiSelect).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'test.md',
        type: NODE_TYPES.FILE
      })
    ]);
  });

  test('renders without data provider', () => {
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={null}
        onFileSelect={() => {}}
      />
    );

    expect(screen.getByText('No data provider configured')).toBeInTheDocument();
  });

  test('handles view mode toggle', () => {
    const mockProvider = createMockProvider(mockTreeData, mockFiles);
    
    renderWithProvider(
      <UnifiedFileBrowser
        dataProvider={mockProvider}
        onFileSelect={() => {}}
      />
    );

    const listButton = screen.getByText('List');
    fireEvent.click(listButton);
    
    // Should switch to list view (tree column should be hidden)
    expect(screen.queryByText('Files and folders')).not.toBeInTheDocument();
  });
});

describe('LocalDocumentsProvider', () => {
  test('converts documents to tree structure', async () => {
    const mockContext = {
      documents: [
        {
          id: 1,
          name: 'test.md',
          category: 'General',
          content: 'Test content',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      categories: ['General', 'Work']
    };

    const provider = new LocalDocumentsProvider(mockContext);
    const treeStructure = await provider.getTreeStructure();

    expect(treeStructure).toHaveLength(2);
    expect(treeStructure[0].name).toBe('General');
    expect(treeStructure[0].children).toHaveLength(1);
    expect(treeStructure[0].children[0].name).toBe('test.md');
  });

  test('gets files in category path', async () => {
    const mockContext = {
      documents: [
        {
          id: 1,
          name: 'test.md',
          category: 'General',
          content: 'Test content'
        }
      ],
      categories: ['General']
    };

    const provider = new LocalDocumentsProvider(mockContext);
    const files = await provider.getFilesInPath('/General');

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.md');
    expect(files[0].documentId).toBe(1);
  });

  test('gets file content', async () => {
    const mockContext = {
      documents: [
        {
          id: 1,
          name: 'test.md',
          content: 'Test content'
        }
      ]
    };

    const provider = new LocalDocumentsProvider(mockContext);
    const content = await provider.getFileContent({ documentId: 1 });

    expect(content).toBe('Test content');
  });

  test('returns display name', () => {
    const provider = new LocalDocumentsProvider({});
    expect(provider.getDisplayName()).toBe('My Documents');
  });
});

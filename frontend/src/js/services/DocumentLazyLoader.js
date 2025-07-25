// Document lazy loading service for extremely large documents
import PerformanceOptimizer from './PerformanceOptimizer';

class DocumentLazyLoader {
  constructor() {
    this.loadedChunks = new Map();
    this.documentSize = 0;
    this.chunkSize = 50000; // 50KB chunks
    this.totalChunks = 0;
    this.virtualDocument = '';
  }

  /**
   * Determine if document should use lazy loading
   */
  shouldUseLazyLoading(content) {
    // Only use lazy loading for truly massive documents (>5MB)
    return content && content.length > 5000000; // 5MB threshold
  }

  /**
   * Initialize lazy loading for a document
   */
  initializeLazyLoading(content) {
    if (!this.shouldUseLazyLoading(content)) {
      return { useLazyLoading: false, content };
    }

    this.documentSize = content.length;
    this.totalChunks = Math.ceil(this.documentSize / this.chunkSize);
    this.virtualDocument = content;

    // Create initial placeholder content with metadata
    const placeholderContent = this.createPlaceholderContent(content);

    return {
      useLazyLoading: true,
      content: placeholderContent,
      metadata: {
        originalSize: this.documentSize,
        totalChunks: this.totalChunks,
        chunkSize: this.chunkSize
      }
    };
  }

  /**
   * Create a lightweight placeholder version of the document
   */
  createPlaceholderContent(content) {
    const lines = content.split('\n');
    const totalLines = lines.length;
    const sampleSize = Math.min(100, Math.floor(totalLines * 0.1)); // Show 10% or 100 lines max

    const header = `<!-- PERFORMANCE MODE ACTIVE -->
<!-- Original document: ${Math.round(content.length / 1024)}KB, ${totalLines} lines -->
<!-- Showing first ${sampleSize} lines for performance -->
<!-- Editor optimized for large document viewing and editing -->

`;

    const sampleLines = lines.slice(0, sampleSize);
    const truncationNotice = totalLines > sampleSize ? `

<!-- ... Document continues for ${totalLines - sampleSize} more lines ... -->
<!-- Use search functionality to navigate to specific content -->
<!-- Full document is available for editing and will be saved completely -->

` : '';

    return header + sampleLines.join('\n') + truncationNotice;
  }

  /**
   * Get a specific chunk of the document
   */
  getChunk(chunkIndex) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) {
      return '';
    }

    if (this.loadedChunks.has(chunkIndex)) {
      return this.loadedChunks.get(chunkIndex);
    }

    const startIndex = chunkIndex * this.chunkSize;
    const endIndex = Math.min(startIndex + this.chunkSize, this.documentSize);
    const chunk = this.virtualDocument.slice(startIndex, endIndex);

    this.loadedChunks.set(chunkIndex, chunk);
    return chunk;
  }

  /**
   * Search for content in the document without loading everything
   */
  searchInDocument(searchTerm, maxResults = 50) {
    const results = [];
    const regex = new RegExp(searchTerm, 'gi');

    for (let chunkIndex = 0; chunkIndex < this.totalChunks && results.length < maxResults; chunkIndex++) {
      const chunk = this.getChunk(chunkIndex);
      const chunkLines = chunk.split('\n');
      const chunkStartLine = chunkIndex * Math.floor(this.chunkSize / 50); // Approximate lines per chunk

      chunkLines.forEach((line, lineIndex) => {
        if (results.length >= maxResults) return;

        const matches = [...line.matchAll(regex)];
        matches.forEach(match => {
          if (results.length >= maxResults) return;

          results.push({
            line: chunkStartLine + lineIndex + 1,
            column: match.index + 1,
            text: line.trim(),
            match: match[0]
          });
        });
      });
    }

    return results;
  }

  /**
   * Get document statistics without loading full content
   */
  getDocumentStats() {
    if (!this.virtualDocument) {
      return null;
    }

    // Sample the first chunk to estimate statistics
    const firstChunk = this.getChunk(0);
    const sampleLines = firstChunk.split('\n').length;
    const estimatedTotalLines = Math.round((sampleLines / this.chunkSize) * this.documentSize);

    return {
      totalSize: this.documentSize,
      totalSizeFormatted: this.formatBytes(this.documentSize),
      estimatedLines: estimatedTotalLines,
      totalChunks: this.totalChunks,
      chunkSize: this.chunkSize,
      loadedChunks: this.loadedChunks.size
    };
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get recommendations for handling the large document
   */
  getPerformanceRecommendations(content) {
    const size = content.length;
    const sizeKB = Math.round(size / 1024);

    if (size > 2000000) { // 2MB+
      return {
        severity: 'critical',
        message: `Document is extremely large (${sizeKB}KB). Consider these options:`,
        recommendations: [
          'Split into multiple smaller documents',
          'Remove unnecessary content or formatting',
          'Consider using external file storage',
          'Use document sections or chapters',
          'Performance mode is highly recommended'
        ]
      };
    } else if (size > 1000000) { // 1MB+
      return {
        severity: 'high',
        message: `Large document detected (${sizeKB}KB). Recommendations:`,
        recommendations: [
          'Consider splitting into sections',
          'Remove large embedded content if possible',
          'Use performance mode for better experience',
          'Search functionality recommended for navigation'
        ]
      };
    }

    return null;
  }

  /**
   * Clear cached chunks to free memory
   */
  clearCache() {
    this.loadedChunks.clear();
  }

  /**
   * Reset the lazy loader
   */
  reset() {
    this.clearCache();
    this.documentSize = 0;
    this.totalChunks = 0;
    this.virtualDocument = '';
  }
}

export default new DocumentLazyLoader();

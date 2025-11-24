/**
 * Markdown Code Fence Parser
 * Extracts code fences from markdown with language detection and position tracking
 * Supports standard markdown fenced code blocks with language hints
 */

class MarkdownCodeFenceParser {
  constructor() {
    // Regex pattern for detecting code fences
    this.codeFenceRegex = /^```(\w*)\s*\n([\s\S]*?)^```\s*$/gm;

    // Language aliases mapping
    this.languageAliases = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'rs': 'rust',
      'go': 'golang',
      'c++': 'cpp',
      'c#': 'csharp',
      'cs': 'csharp',
      'sh': 'bash',
      'shell': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'ps1': 'powershell',
      'yml': 'yaml',
      'dockerfile': 'docker',
      'md': 'markdown',
      'vue': 'html',
      'svelte': 'html',
      'htm': 'html'
    };

    // Supported languages for spell checking
    this.supportedLanguages = new Set([
      'javascript', 'typescript', 'python', 'java', 'php', 'html', 'css', 'scss', 'sass', 'less',
      'json', 'yaml', 'sql', 'cpp', 'c', 'rust', 'golang', 'csharp', 'bash', 'docker', 'powershell',
      'ruby', 'swift', 'kotlin', 'scala', 'perl', 'lua', 'r', 'matlab', 'haskell', 'elixir', 'erlang',
      'clojure', 'scheme', 'racket', 'lisp', 'prolog', 'fortran', 'cobol', 'ada', 'pascal', 'delphi',
      'vb', 'vbnet', 'fsharp', 'ocaml', 'ml', 'sml', 'nim', 'crystal', 'dart', 'groovy', 'coffeescript',
      'livescript', 'purescript', 'elm', 'reason', 'reasonml', 'rescript', 'solidity', 'vyper', 'move',
      'cairo', 'noir', 'circom', 'yul', 'assembly', 'nasm', 'masm', 'gas', 'llvm', 'webassembly', 'wat',
      'markdown', 'tex', 'latex', 'bibtex', 'org', 'rst', 'asciidoc', 'textile', 'wiki', 'mediawiki',
      'graphql', 'protobuf', 'thrift', 'avro', 'messagepack', 'capnproto', 'flatbuffers', 'grpc',
      'toml', 'ini', 'cfg', 'conf', 'properties', 'env', 'dotenv', 'editorconfig', 'gitignore',
      'nginx', 'apache', 'htaccess', 'robots', 'sitemap', 'feed', 'atom', 'rss', 'opml', 'foaf',
      'xml', 'xhtml', 'svg', 'mathml', 'rdf', 'owl', 'ttl', 'n3', 'jsonld', 'microdata', 'rdfa',
      'xsl', 'xslt', 'xpath', 'xquery', 'sparql', 'cypher', 'gremlin', 'aql', 'n1ql', 'cql',
      'mdx', 'svx', 'astro', 'solid', 'qwik', 'fresh', 'next', 'nuxt', 'gatsby', 'remix', 'sveltekit'
    ]);
  }

  /**
   * Parse markdown text and extract all code fences
   * @param {string} text - The markdown text to parse
   * @returns {Array} Array of code fence objects with position and language info
   */
  parseCodeFences(text) {
    const codeFences = [];
    let match;

    // Reset regex to start from beginning
    this.codeFenceRegex.lastIndex = 0;

    while ((match = this.codeFenceRegex.exec(text)) !== null) {
      const [fullMatch, language, code] = match;
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      // Calculate line numbers
      const beforeText = text.substring(0, startIndex);
      const startLine = beforeText.split('\n').length;
      const codeLines = code.split('\n').length;
      const endLine = startLine + codeLines + 1; // +1 for closing fence

      // Normalize language identifier
      const normalizedLanguage = this.normalizeLanguage(language);

      // Calculate position within the code block (excluding fence markers)
      const codeStartIndex = startIndex + match[0].indexOf('\n') + 1; // After opening fence
      const codeEndIndex = codeStartIndex + code.length;

      const codeFence = {
        language: normalizedLanguage,
        originalLanguage: language || 'text',
        code: code,
        position: {
          start: startIndex,
          end: endIndex,
          codeStart: codeStartIndex,
          codeEnd: codeEndIndex
        },
        lineNumbers: {
          start: startLine,
          end: endLine,
          codeStart: startLine + 1,
          codeEnd: startLine + codeLines
        },
        size: code.length,
        supported: this.isLanguageSupported(normalizedLanguage),
        fullMatch: fullMatch,
        index: codeFences.length
      };

      codeFences.push(codeFence);
    }

    return codeFences;
  }

  /**
   * Normalize language identifier using aliases
   * @param {string} language - Raw language identifier from fence
   * @returns {string} Normalized language identifier
   */
  normalizeLanguage(language) {
    if (!language) return 'text';

    const lowercased = language.toLowerCase().trim();
    return this.languageAliases[lowercased] || lowercased;
  }

  /**
   * Check if a language is supported for spell checking
   * @param {string} language - Language identifier
   * @returns {boolean} True if language is supported
   */
  isLanguageSupported(language) {
    return this.supportedLanguages.has(language);
  }

  /**
   * Extract only the supported code fences
   * @param {string} text - The markdown text to parse
   * @returns {Array} Array of supported code fence objects
   */
  getSupportedCodeFences(text) {
    const allFences = this.parseCodeFences(text);
    return allFences.filter(fence => fence.supported);
  }

  /**
   * Get statistics about code fences in the text
   * @param {string} text - The markdown text to parse
   * @returns {Object} Statistics object
   */
  getStatistics(text) {
    const allFences = this.parseCodeFences(text);
    const supportedFences = allFences.filter(fence => fence.supported);

    // Count languages
    const languageCounts = {};
    const supportedLanguages = new Set();
    const unsupportedLanguages = new Set();

    allFences.forEach(fence => {
      const lang = fence.language;
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;

      if (fence.supported) {
        supportedLanguages.add(lang);
      } else {
        unsupportedLanguages.add(lang);
      }
    });

    // Calculate total code size
    const totalCodeSize = allFences.reduce((sum, fence) => sum + fence.size, 0);
    const supportedCodeSize = supportedFences.reduce((sum, fence) => sum + fence.size, 0);

    return {
      totalFences: allFences.length,
      supportedFences: supportedFences.length,
      unsupportedFences: allFences.length - supportedFences.length,
      languageCounts,
      supportedLanguages: Array.from(supportedLanguages),
      unsupportedLanguages: Array.from(unsupportedLanguages),
      totalCodeSize,
      supportedCodeSize,
      coverage: allFences.length > 0 ? (supportedFences.length / allFences.length) * 100 : 0,
      averageFenceSize: allFences.length > 0 ? Math.round(totalCodeSize / allFences.length) : 0
    };
  }

  /**
   * Find code fence at a specific position in the text
   * @param {string} text - The markdown text
   * @param {number} position - Character position to check
   * @returns {Object|null} Code fence object if position is within a fence, null otherwise
   */
  findCodeFenceAtPosition(text, position) {
    const codeFences = this.parseCodeFences(text);

    for (const fence of codeFences) {
      if (position >= fence.position.codeStart && position <= fence.position.codeEnd) {
        return fence;
      }
    }

    return null;
  }

  /**
   * Check if a position is within any code fence
   * @param {string} text - The markdown text
   * @param {number} position - Character position to check
   * @returns {boolean} True if position is within a code fence
   */
  isPositionInCodeFence(text, position) {
    return this.findCodeFenceAtPosition(text, position) !== null;
  }

  /**
   * Extract all code content for a specific language
   * @param {string} text - The markdown text
   * @param {string} language - Language to extract
   * @returns {Array} Array of code strings for the specified language
   */
  extractCodeByLanguage(text, language) {
    const normalizedLanguage = this.normalizeLanguage(language);
    const codeFences = this.parseCodeFences(text);

    return codeFences
      .filter(fence => fence.language === normalizedLanguage)
      .map(fence => ({
        code: fence.code,
        position: fence.position,
        lineNumbers: fence.lineNumbers
      }));
  }

  /**
   * Replace code content in a code fence
   * @param {string} text - The original markdown text
   * @param {number} fenceIndex - Index of the fence to replace
   * @param {string} newCode - New code content
   * @returns {string} Updated markdown text
   */
  replaceCodeInFence(text, fenceIndex, newCode) {
    const codeFences = this.parseCodeFences(text);

    if (fenceIndex < 0 || fenceIndex >= codeFences.length) {
      throw new Error(`Invalid fence index: ${fenceIndex}`);
    }

    const fence = codeFences[fenceIndex];
    const before = text.substring(0, fence.position.codeStart);
    const after = text.substring(fence.position.codeEnd);

    return before + newCode + after;
  }

  /**
   * Add language support dynamically
   * @param {string|Array} languages - Language(s) to add support for
   */
  addLanguageSupport(languages) {
    const langs = Array.isArray(languages) ? languages : [languages];
    langs.forEach(lang => this.supportedLanguages.add(lang));
  }

  /**
   * Remove language support
   * @param {string|Array} languages - Language(s) to remove support for
   */
  removeLanguageSupport(languages) {
    const langs = Array.isArray(languages) ? languages : [languages];
    langs.forEach(lang => this.supportedLanguages.delete(lang));
  }

  /**
   * Get all supported languages
   * @returns {Array} Array of supported language identifiers
   */
  getSupportedLanguages() {
    return Array.from(this.supportedLanguages).sort();
  }

  /**
   * Add language alias
   * @param {string} alias - The alias to add
   * @param {string} target - The target language
   */
  addLanguageAlias(alias, target) {
    this.languageAliases[alias.toLowerCase()] = target;
  }

  /**
   * Get language aliases
   * @returns {Object} Map of aliases to target languages
   */
  getLanguageAliases() {
    return { ...this.languageAliases };
  }

  /**
   * Validate markdown text for code fence syntax
   * @param {string} text - The markdown text to validate
   * @returns {Object} Validation result with errors if any
   */
  validateCodeFences(text) {
    const errors = [];
    const warnings = [];

    // Check for unclosed code fences
    const openFences = (text.match(/^```/gm) || []).length;
    const closeFences = openFences; // Same pattern matches both opening and closing

    if (openFences % 2 !== 0) {
      errors.push({
        type: 'unclosed_fence',
        message: 'Unclosed code fence detected',
        severity: 'error'
      });
    }

    // Check for empty code blocks
    const codeFences = this.parseCodeFences(text);
    codeFences.forEach((fence, index) => {
      if (fence.code.trim().length === 0) {
        warnings.push({
          type: 'empty_code_block',
          message: `Empty code block at line ${fence.lineNumbers.start}`,
          severity: 'warning',
          position: fence.position,
          fenceIndex: index
        });
      }
    });

    // Check for unsupported languages
    codeFences.forEach((fence, index) => {
      if (!fence.supported && fence.originalLanguage) {
        warnings.push({
          type: 'unsupported_language',
          message: `Unsupported language '${fence.originalLanguage}' at line ${fence.lineNumbers.start}`,
          severity: 'info',
          position: fence.position,
          fenceIndex: index,
          language: fence.originalLanguage
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      statistics: this.getStatistics(text)
    };
  }
}

module.exports = MarkdownCodeFenceParser;
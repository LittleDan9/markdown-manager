/**
 * Language Configuration Module
 * Contains language-specific patterns and configurations for code fence spell checking
 */

class LanguageConfig {
  constructor() {
    // Language configuration matrix with patterns for comment, string, and identifier extraction
    this.supportedLanguages = {
      // High priority - common languages
      'javascript': {
        cspellId: 'javascript',
        checkIdentifiers: true,
        fileExtension: 'js',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm           // Line comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted strings
          /'([^'\\]|\\.)*'/g,   // Single quoted strings
          /`([^`\\]|\\.)*`/g    // Template literals
        ],
        identifierPattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g
      },
      'typescript': {
        cspellId: 'typescript',
        checkIdentifiers: true,
        fileExtension: 'ts',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm           // Line comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted strings
          /'([^'\\]|\\.)*'/g,   // Single quoted strings
          /`([^`\\]|\\.)*`/g    // Template literals
        ],
        identifierPattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g
      },
      'python': {
        cspellId: 'python',
        checkIdentifiers: true,
        fileExtension: 'py',
        commentPatterns: [
          /#.*$/gm,                    // Line comments
          /"""[\s\S]*?"""/g,          // Triple double quote docstrings
          /'''[\s\S]*?'''/g           // Triple single quote docstrings
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted strings
          /'([^'\\]|\\.)*'/g,   // Single quoted strings
          /"""[\s\S]*?"""/g,    // Triple double quotes
          /'''[\s\S]*?'''/g     // Triple single quotes
        ],
        identifierPattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      },
      'java': {
        cspellId: 'java',
        checkIdentifiers: true,
        fileExtension: 'java',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm           // Line comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g    // Double quoted strings
        ],
        identifierPattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g
      },
      'html': {
        cspellId: 'html',
        checkIdentifiers: false,
        fileExtension: 'html',
        commentPatterns: [
          /<!--[\s\S]*?-->/g    // HTML comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted attributes
          /'([^'\\]|\\.)*'/g    // Single quoted attributes
        ],
        identifierPattern: /\b[a-zA-Z_-][a-zA-Z0-9_-]*\b/g
      },
      'php': {
        cspellId: 'php',
        checkIdentifiers: true,
        fileExtension: 'php',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm,          // Line comments
          /#.*$/gm              // Hash comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted strings
          /'([^'\\]|\\.)*'/g    // Single quoted strings
        ],
        identifierPattern: /\$?[a-zA-Z_][a-zA-Z0-9_]*\b/g
      },
      'json': {
        cspellId: 'json',
        checkIdentifiers: false,
        fileExtension: 'json',
        commentPatterns: [],  // JSON doesn't have comments
        stringPatterns: [
          /"([^"\\]|\\.)*"/g    // Double quoted strings (keys and values)
        ],
        identifierPattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      },
      'yaml': {
        cspellId: 'yaml',
        checkIdentifiers: false,
        fileExtension: 'yml',
        commentPatterns: [
          /#.*$/gm              // Hash comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted strings
          /'([^'\\]|\\.)*'/g    // Single quoted strings
        ],
        identifierPattern: /\b[a-zA-Z_-][a-zA-Z0-9_-]*\b/g
      },
      'sql': {
        cspellId: 'sql',
        checkIdentifiers: true,
        fileExtension: 'sql',
        commentPatterns: [
          /--.*$/gm,            // Line comments
          /\/\*[\s\S]*?\*\//g   // Block comments
        ],
        stringPatterns: [
          /'([^'\\]|\\.)*'/g    // Single quoted strings
        ],
        identifierPattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      },
      'cpp': {
        cspellId: 'cpp',
        checkIdentifiers: true,
        fileExtension: 'cpp',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm           // Line comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g    // Double quoted strings
        ],
        identifierPattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      },
      'rust': {
        cspellId: 'rust',
        checkIdentifiers: true,
        fileExtension: 'rs',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm           // Line comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g    // Double quoted strings
        ],
        identifierPattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      },
      'go': {
        cspellId: 'go',
        checkIdentifiers: true,
        fileExtension: 'go',
        commentPatterns: [
          /\/\*[\s\S]*?\*\//g,  // Block comments
          /\/\/.*$/gm           // Line comments
        ],
        stringPatterns: [
          /"([^"\\]|\\.)*"/g,   // Double quoted strings
          /`([^`\\]|\\.)*`/g    // Raw strings
        ],
        identifierPattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
      }
    };

    // Issue severity mapping for different content types
    this.codeIssueSeverity = {
      'code-comment': 'info',        // Blue underline - comments
      'code-string': 'hint',         // Gray underline - strings
      'code-identifier': 'info',     // Blue underline - variables
      'code-documentation': 'info'   // Blue underline - JSDoc/docstrings
    };

    // Language aliases for common variations
    this.languageAliases = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'c++': 'cpp',
      'c': 'cpp',
      'h': 'cpp',
      'hpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'rs': 'rust',
      'golang': 'go',
      'yml': 'yaml',
      'htm': 'html'
    };
  }

  /**
   * Get language configuration by name or alias
   * @param {string} language - Language name or alias
   * @returns {Object|null} Language configuration object
   */
  getLanguageConfig(language) {
    if (!language) return null;

    const normalizedLang = language.toLowerCase();

    // Check direct match first
    if (this.supportedLanguages[normalizedLang]) {
      return this.supportedLanguages[normalizedLang];
    }

    // Check aliases
    const aliasedLang = this.languageAliases[normalizedLang];
    if (aliasedLang && this.supportedLanguages[aliasedLang]) {
      return this.supportedLanguages[aliasedLang];
    }

    return null;
  }

  /**
   * Check if a language is supported
   * @param {string} language - Language name
   * @returns {boolean} True if supported
   */
  isLanguageSupported(language) {
    return this.getLanguageConfig(language) !== null;
  }

  /**
   * Get all supported language names
   * @returns {Array<string>} Array of language names
   */
  getSupportedLanguages() {
    return Object.keys(this.supportedLanguages);
  }

  /**
   * Get language configuration count
   * @returns {number} Number of supported languages
   */
  getLanguageCount() {
    return Object.keys(this.supportedLanguages).length;
  }

  /**
   * Get issue severity for content type
   * @param {string} contentType - Type of content (comment, string, identifier)
   * @returns {string} Severity level
   */
  getIssueSeverity(contentType) {
    return this.codeIssueSeverity[`code-${contentType}`] || 'info';
  }

  /**
   * Check if a word is a language keyword or builtin
   * @param {string} word - Word to check
   * @param {Object} langConfig - Language configuration
   * @returns {boolean} True if it's a keyword/builtin
   */
  isKeywordOrBuiltin(word, langConfig) {
    // Common keywords across languages
    const commonKeywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return', 'function', 'class',
      'var', 'let', 'const', 'true', 'false', 'null', 'undefined', 'this', 'new', 'try', 'catch',
      'throw', 'finally', 'switch', 'case', 'default', 'typeof', 'instanceof', 'in', 'of',
      'import', 'export', 'from', 'as', 'async', 'await', 'yield', 'static', 'extends', 'super',
      'get', 'set', 'delete', 'void', 'with', 'debugger'
    ]);

    // Language-specific keywords
    const languageKeywords = {
      'python': new Set([
        'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally',
        'with', 'as', 'import', 'from', 'lambda', 'pass', 'break', 'continue', 'return',
        'yield', 'global', 'nonlocal', 'assert', 'del', 'and', 'or', 'not', 'is', 'in',
        'True', 'False', 'None', 'self', 'cls'
      ]),
      'java': new Set([
        'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized',
        'volatile', 'transient', 'native', 'strictfp', 'class', 'interface', 'enum',
        'extends', 'implements', 'package', 'import', 'throws', 'throw', 'try', 'catch',
        'finally', 'instanceof', 'new', 'this', 'super', 'void', 'int', 'boolean', 'char',
        'byte', 'short', 'long', 'float', 'double'
      ]),
      'typescript': new Set([
        'interface', 'type', 'declare', 'namespace', 'module', 'enum', 'readonly',
        'public', 'private', 'protected', 'abstract', 'implements', 'keyof', 'typeof',
        'never', 'unknown', 'any', 'object', 'string', 'number', 'boolean', 'symbol'
      ])
    };

    const lowerWord = word.toLowerCase();

    // Check common keywords
    if (commonKeywords.has(lowerWord)) {
      return true;
    }

    // Check language-specific keywords
    const langKeywords = languageKeywords[langConfig.cspellId];
    if (langKeywords && langKeywords.has(lowerWord)) {
      return true;
    }

    return false;
  }
}

module.exports = LanguageConfig;
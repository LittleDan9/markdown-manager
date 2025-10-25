/**
 * Spell Checking Engine Module
 * Handles the actual spell checking logic with technical dictionaries and fallback mechanisms
 */

class SpellEngine {
  constructor() {
    this.cspell = null;
    this.spellCheck = null;
    this.initialized = false;

    // Initialize dictionaries
    this.initializeDictionaries();
  }

  /**
   * Initialize spell checking engine
   */
  async initializeCSpell() {
    try {
      this.cspell = await import('cspell');
      this.initialized = true;
      return this.cspell;
    } catch (error) {
      console.warn('[SpellEngine] cspell package not available, using fallback dictionary');
      this.initialized = true; // Still initialized, just with fallback
      return null;
    }
  }

  /**
   * Initialize technical dictionaries and misspelling patterns
   */
  initializeDictionaries() {
    // Technical dictionary - words that should NOT be flagged as misspellings
    this.technicalDictionary = new Set([
      // Programming concepts
      'api', 'apis', 'url', 'urls', 'uri', 'uris', 'http', 'https', 'json', 'xml', 'html', 'css', 'javascript', 'typescript',
      'async', 'await', 'promise', 'callback', 'closure', 'prototype', 'middleware', 'authentication', 'authorization',
      'crud', 'rest', 'restful', 'graphql', 'websocket', 'cors', 'csrf', 'jwt', 'oauth', 'ssl', 'tls',

      // JavaScript/TypeScript keywords and common terms
      'constructor', 'function', 'class', 'interface', 'extends', 'implements', 'static', 'private', 'public', 'protected',
      'readonly', 'abstract', 'override', 'super', 'this', 'typeof', 'instanceof', 'delete', 'void', 'null', 'undefined',
      'boolean', 'string', 'number', 'object', 'array', 'symbol', 'bigint', 'const', 'let', 'var', 'enum',

      // Programming languages and frameworks
      'nodejs', 'react', 'angular', 'vue', 'express', 'fastify', 'webpack', 'babel', 'typescript', 'python',
      'java', 'csharp', 'php', 'ruby', 'golang', 'rust', 'kotlin', 'swift', 'scala', 'perl',

      // Database and storage
      'database', 'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'memcached',
      'orm', 'odm', 'migration', 'schema', 'index', 'foreign', 'primary', 'constraint',

      // DevOps and infrastructure
      'docker', 'kubernetes', 'container', 'orchestration', 'microservice', 'serverless', 'lambda',
      'cicd', 'deployment', 'pipeline', 'artifact', 'repository', 'registry', 'cluster',
      'nginx', 'apache', 'loadbalancer', 'proxy', 'gateway', 'cdn', 'cache', 'redis',

      // Version control
      'git', 'github', 'gitlab', 'bitbucket', 'commit', 'branch', 'merge', 'rebase', 'pull', 'push',
      'repository', 'repo', 'clone', 'fork', 'upstream', 'downstream',

      // Testing
      'unittest', 'integration', 'e2e', 'tdd', 'bdd', 'mock', 'stub', 'spy', 'assertion',
      'jest', 'mocha', 'chai', 'jasmine', 'cypress', 'selenium', 'playwright',

      // Code quality
      'linting', 'eslint', 'prettier', 'sonar', 'coverage', 'refactor', 'technical', 'debt',
      'codereview', 'pullrequest', 'mergerequest',

      // Common variable patterns
      'config', 'configs', 'env', 'args', 'params', 'req', 'res', 'ctx', 'opts', 'utils',
      'init', 'setup', 'teardown', 'cleanup', 'validate', 'sanitize', 'serialize', 'deserialize',
      'encode', 'decode', 'encrypt', 'decrypt', 'hash', 'auth', 'uuid', 'guid',

      // File extensions and formats
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'hpp', 'cs', 'php', 'rb', 'go', 'rs',
      'yml', 'yaml', 'toml', 'ini', 'env', 'dockerfile', 'makefile', 'gitignore',

      // Common tech abbreviations
      'ui', 'ux', 'cli', 'gui', 'ide', 'sdk', 'api', 'spi', 'abi', 'vm', 'jvm', 'clr',
      'cpu', 'gpu', 'ram', 'ssd', 'hdd', 'io', 'tcp', 'udp', 'dns', 'dhcp', 'vpn',

      // Markdown and documentation
      'markdown', 'readme', 'changelog', 'license', 'contributing', 'docs', 'wiki',
      'codeblock', 'codespace', 'gist', 'snippet', 'example', 'tutorial', 'guide'
    ]);

    // Common misspellings that we can detect with suggestions
    this.commonMisspellings = {
      'coment': ['comment'],
      'misspeling': ['misspelling'],
      'eror': ['error'],
      'jhon': ['john'],
      'funciton': ['function'],
      'variabl': ['variable'],
      'retrun': ['return'],
      'lenght': ['length'],
      'widht': ['width'],
      'heigth': ['height'],
      'indentifier': ['identifier'],
      'paramter': ['parameter'],
      'arguement': ['argument'],
      'recieve': ['receive'],
      'seperate': ['separate'],
      'bolean': ['boolean'],
      'charecter': ['character'],
      'enviroment': ['environment'],
      'developement': ['development'],
      'definitly': ['definitely'],
      'neccessary': ['necessary'],
      'occured': ['occurred'],
      'begining': ['beginning'],
      'enviromental': ['environmental'],
      'responce': ['response'],
      'refernce': ['reference'],
      'intialize': ['initialize'],
      'initalize': ['initialize'],
      'refactor': ['refactor'],
      'repositry': ['repository'],
      'authentification': ['authentication'],
      'congifuration': ['configuration'],
      'configration': ['configuration'],
      'databse': ['database'],
      'destory': ['destroy'],
      'excute': ['execute'],
      'exicute': ['execute'],
      'handel': ['handle'],
      'implmentation': ['implementation'],
      'initalizing': ['initializing'],
      'methd': ['method'],
      'prameter': ['parameter'],
      'proces': ['process'],
      'recived': ['received'],
      'successfull': ['successful'],
      'sucess': ['success'],
      'temperary': ['temporary'],
      'temparary': ['temporary'],
      'throug': ['through'],
      'thru': ['through'],
      'validaton': ['validation'],
      'valication': ['validation'],
      'writen': ['written'],
      'writeable': ['writable'],
      'catagory': ['category'],
      'cateogry': ['category'],
      'dependancy': ['dependency'],
      'dependeny': ['dependency'],
      'extention': ['extension'],
      'extenstion': ['extension'],
      'libarary': ['library'],
      'librery': ['library'],
      'migarte': ['migrate'],
      'migeration': ['migration'],
      'promis': ['promise'],
      'promize': ['promise'],
      'recusrive': ['recursive'],
      'recrusive': ['recursive'],
      'requirment': ['requirement'],
      'requierment': ['requirement'],
      'specificly': ['specifically'],
      'symetric': ['symmetric'],
      'symetrical': ['symmetrical'],
      'tranaction': ['transaction'],
      'transacion': ['transaction'],
      'trasaction': ['transaction'],
      'undefine': ['undefined'],
      'undefind': ['undefined'],
      'utitlity': ['utility'],
      'utilty': ['utility']
    };
  }

  /**
   * Check content with spell checker (with fallback to dictionary approach)
   * @param {string} text - Text to check
   * @param {string} language - Programming language
   * @param {Array} customWords - Custom words to add
   * @returns {Promise<Array>} Array of spelling issues
   */
  async checkContent(text, language, customWords = []) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      // Try cspell first if available
      if (this.cspell && this.spellCheck) {
        return await this.checkWithCSpell(text, language, customWords);
      }

      // Fallback to dictionary-based checking
      return this.checkWithFallback(text, customWords);
    } catch (error) {
      console.warn(`[SpellEngine] Spell check failed for ${language}:`, error.message);
      return [];
    }
  }

  /**
   * Check content using cspell library
   * @param {string} text - Text to check
   * @param {string} language - Programming language
   * @param {Array} customWords - Custom words to add
   * @returns {Promise<Array>} Array of spelling issues
   */
  async checkWithCSpell(text, language, customWords = []) {
    try {
      // Create a simple configuration for cSpell
      const config = {
        language: 'en',
        words: customWords,
        minWordLength: 3,
        maxNumberOfProblems: 10000,
        maxDuplicateProblems: 100,
        dictionaries: ['en', 'companies', 'softwareTerms', 'typescript', 'node', 'npm']
      };

      // Add programming language specific dictionaries
      if (language) {
        const langDict = this.getLanguageDictionary(language);
        if (langDict && !config.dictionaries.includes(langDict)) {
          config.dictionaries.push(langDict);
        }
      }

      // Use cSpell checkText function
      const { checkText } = this.cspell;
      const result = await checkText(text, config);

      // Transform cSpell results to our format
      const issues = [];
      if (result.issues) {
        for (const issue of result.issues) {
          issues.push({
            text: issue.text,
            offset: issue.offset,
            suggestions: issue.suggestions?.slice(0, 5) || []
          });
        }
      }

      return issues;
    } catch (error) {
      console.warn('[SpellEngine] cSpell failed, falling back to dictionary:', error.message);
      return this.checkWithFallback(text, customWords);
    }
  }

  /**
   * Get language-specific dictionary name for cSpell
   * @param {string} language - Programming language
   * @returns {string|null} Dictionary name
   */
  getLanguageDictionary(language) {
    const languageDictionaries = {
      'javascript': 'typescript',
      'typescript': 'typescript',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'php': 'php',
      'ruby': 'ruby',
      'go': 'golang',
      'rust': 'rust',
      'html': 'html',
      'css': 'css'
    };

    return languageDictionaries[language?.toLowerCase()] || null;
  }

  /**
   * Check content using fallback dictionary approach
   * @param {string} text - Text to check
   * @param {Array} customWords - Custom words to add
   * @returns {Array} Array of spelling issues
   */
  checkWithFallback(text, customWords = []) {
    const issues = [];

    // Create combined technical dictionary including custom words
    const combinedDictionary = new Set([
      ...this.technicalDictionary,
      ...customWords.map(w => w.toLowerCase())
    ]);

    // Use regex to match words with position tracking
    const wordRegex = /\b\w+\b/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');

      // Skip short words, numbers, and technical dictionary words
      if (cleanWord.length < 3 || /^\d+$/.test(cleanWord) || combinedDictionary.has(cleanWord)) {
        continue;
      }

      if (this.commonMisspellings[cleanWord]) {
        issues.push({
          text: word, // Use original word, not cleaned
          offset: match.index, // Use actual regex match position
          suggestions: this.commonMisspellings[cleanWord]
        });
      }
    }

    return issues;
  }

  /**
   * Add custom words to technical dictionary
   * @param {Array} words - Array of words to add
   */
  addCustomWords(words) {
    words.forEach(word => {
      this.technicalDictionary.add(word.toLowerCase());
    });
  }

  /**
   * Add custom misspelling patterns
   * @param {Object} patterns - Object with misspelling -> [suggestions] mapping
   */
  addMisspellingPatterns(patterns) {
    Object.assign(this.commonMisspellings, patterns);
  }

  /**
   * Check if a word is in the technical dictionary
   * @param {string} word - Word to check
   * @returns {boolean} True if word is in technical dictionary
   */
  isInTechnicalDictionary(word) {
    return this.technicalDictionary.has(word.toLowerCase());
  }

  /**
   * Get suggestions for a misspelled word
   * @param {string} word - Misspelled word
   * @returns {Array} Array of suggestions
   */
  getSuggestions(word) {
    const lowerWord = word.toLowerCase();
    return this.commonMisspellings[lowerWord] || [];
  }

  /**
   * Get technical dictionary size
   * @returns {number} Number of words in technical dictionary
   */
  getTechnicalDictionarySize() {
    return this.technicalDictionary.size;
  }

  /**
   * Get number of known misspelling patterns
   * @returns {number} Number of misspelling patterns
   */
  getMisspellingPatternsCount() {
    return Object.keys(this.commonMisspellings).length;
  }

  /**
   * Get engine statistics
   * @returns {Object} Engine statistics
   */
  getStatistics() {
    return {
      initialized: this.initialized,
      cspellAvailable: !!this.cspell,
      technicalDictionarySize: this.getTechnicalDictionarySize(),
      misspellingPatternsCount: this.getMisspellingPatternsCount(),
      engineType: this.cspell ? 'cspell' : 'fallback'
    };
  }
}

module.exports = SpellEngine;
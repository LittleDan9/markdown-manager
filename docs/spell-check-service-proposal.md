# Backend Spell Check Service - AI Agent Development Proposal

**Project**: Markdown Manager - Enhanced Spell Check Service
**Proposal Date**: October 22, 2025
**Architecture Pattern**: Following `markdown-lint-service` model
**Development Approach**: AI Agent Phased Implementation

---

## 🎯 Executive Summary

This proposal outlines the development of a comprehensive backend spell check service to replace the current browser-based implementation. The service will provide enterprise-grade spelling, grammar, and style checking capabilities while following established architectural patterns and enabling AI Agent-driven development.

### Current State Analysis

**Browser Implementation Limitations:**

- **Performance**: 551KB dictionary files loaded per worker (up to 6 workers)
- **Capabilities**: Basic spell checking only (~50K English words)
- **Constraints**: Webpack limitations prevent advanced NLP libraries
- **Resource Usage**: High memory footprint in browser
- **Network Overhead**: Dictionary files served from frontend

**Proposed Backend Benefits:**

- **10-100x Performance Improvement**: Native libraries + server hardware
- **Advanced Features**: Grammar, style, multi-language support
- **Enterprise Tools**: Contextual suggestions, custom dictionaries
- **Reduced Bundle Size**: Remove 600KB+ from frontend
- **Scalability**: Shared resources, intelligent caching

---

## 🏗️ Service Architecture Design

### Directory Structure

```text
spell-check-service/
├── Dockerfile                          # Container configuration
├── spell-check-service.service         # Systemd service config
├── package.json                        # Dependencies & scripts
├── server.js                           # Main Express server
├── README.md                          # Service documentation
├── config/
│   ├── default-settings.json          # Service defaults
│   ├── language-detection.json        # Language detection rules
│   └── performance-tuning.json        # Optimization settings
├── dictionaries/                       # Multi-language support
│   ├── en-US/
│   │   ├── index.aff                  # Hunspell affix file
│   │   └── index.dic                  # Dictionary entries
│   ├── en-GB/                         # British English
│   ├── es-ES/                         # Spanish
│   ├── fr-FR/                         # French
│   ├── de-DE/                         # German
│   └── custom/                        # User dictionaries
├── grammar-rules/                      # Grammar checking rules
│   ├── en-US.json                     # English grammar rules
│   ├── common.json                    # Universal rules
│   └── style-guides/                  # Style guide configs
├── lib/
│   ├── SpellChecker.js                # Core spell checking
│   ├── GrammarChecker.js              # Grammar analysis
│   ├── StyleAnalyzer.js               # Style checking
│   ├── LanguageDetector.js            # Auto language detection
│   └── ContextAnalyzer.js             # Contextual suggestions
└── tests/
    ├── unit/                          # Unit tests
    ├── integration/                   # Integration tests
    └── performance/                   # Performance benchmarks
```

### Technology Stack

**Core Dependencies:**

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "nspell": "^2.1.5",
    "natural": "^6.12.0",
    "retext": "^8.1.0",
    "retext-english": "^4.2.0",
    "retext-equality": "^6.6.0",
    "retext-passive": "^4.0.0",
    "retext-readability": "^7.2.0",
    "franc": "^6.1.0",
    "write-good": "^1.0.8",
    "compromise": "^14.10.0",
    "dictionary-en-us": "^3.1.1",
    "dictionary-en-gb": "^2.1.0",
    "dictionary-es": "^2.1.0",
    "dictionary-fr": "^2.1.0",
    "dictionary-de": "^2.1.0"
  }
}
```

### API Specification

#### Core Endpoints

##### Health Check

```http
GET /health
Response: { status: "healthy", service: "spell-check", version: "1.0.0" }
```

##### Main Spell/Grammar Check

```http
POST /check
Content-Type: application/json

Request Body:
{
  "text": "string",                    // Text to analyze
  "language": "en-US",              // Optional, auto-detect if not provided
  "chunk_offset": 0,                // For chunked processing
  "options": {
    "enableSpelling": true,         // Basic spell checking
    "enableGrammar": true,          // Grammar analysis
    "enableStyle": true,            // Style suggestions
    "enableReadability": true,      // Readability metrics
    "customWords": ["word1", "word2"], // User custom dictionary
    "ignoreCodeBlocks": true,       // Skip markdown code blocks
    "contextualSuggestions": true,  // AI-enhanced suggestions
    "styleGuide": "ap"              // AP, Chicago, MLA, etc.
  }
}

Response:
{
  "results": {
    "spelling": [
      {
        "word": "misspeled",
        "suggestions": ["misspelled", "misspell"],
        "position": { "start": 10, "end": 19 },
        "line": 2,
        "column": 5,
        "type": "spelling",
        "severity": "error",
        "confidence": 0.95
      }
    ],
    "grammar": [
      {
        "message": "Passive voice detected",
        "suggestion": "Consider active voice",
        "position": { "start": 25, "end": 40 },
        "type": "grammar",
        "severity": "warning",
        "rule": "passive-voice"
      }
    ],
    "style": [
      {
        "message": "Consider removing 'very'",
        "suggestion": "Use a stronger adjective",
        "position": { "start": 50, "end": 54 },
        "type": "style",
        "severity": "suggestion",
        "rule": "weak-modifiers"
      }
    ],
    "readability": {
      "fleschKincaid": 8.5,
      "gunningFog": 12.2,
      "sentenceCount": 15,
      "wordCount": 234,
      "averageWordsPerSentence": 15.6
    }
  },
  "language": "en-US",
  "confidence": 0.98,
  "processingTime": 145,
  "statistics": {
    "characters": 1250,
    "words": 234,
    "sentences": 15,
    "paragraphs": 4
  }
}
```

##### Language Detection

```http
POST /detect-language
Body: { "text": "string" }
Response: { "language": "en-US", "confidence": 0.95, "alternatives": ["en-GB"] }
```

##### Available Languages

```http
GET /languages
Response: {
  "languages": [
    { "code": "en-US", "name": "English (US)", "available": true },
    { "code": "en-GB", "name": "English (UK)", "available": true }
  ]
}
```

##### Dictionary Management

```http
POST /dictionary/add-word
Body: { "word": "string", "language": "en-US", "scope": "user|global" }

DELETE /dictionary/remove-word
Body: { "word": "string", "language": "en-US", "scope": "user|global" }

GET /dictionary/suggestions/:word?language=en-US
Response: { "suggestions": ["word1", "word2"], "alternatives": ["alt1"] }
```

---

## 🚀 AI Agent Development Phases

### Phase 1: Foundation Service (Week 1-2)

*AI Agent Focus: Core Infrastructure & Basic Functionality*

#### Deliverables

- [ ] **Service Skeleton**: Express server with health endpoint
- [ ] **Docker Configuration**: Dockerfile and docker-compose integration
- [ ] **Basic Spell Checking**: Single language (en-US) with nspell
- [ ] **API Structure**: Core `/check` endpoint with basic response format
- [ ] **Integration Point**: HTTP client in main backend
- [ ] **Documentation**: README and API specification

#### Implementation Details

```javascript
// Phase 1 server.js structure
const express = require('express');
const nspell = require('nspell');
const fs = require('fs');

class BasicSpellChecker {
  constructor() {
    this.speller = null;
    this.initDictionary();
  }

  async initDictionary() {
    // Load en-US dictionary
    const affData = fs.readFileSync('./dictionaries/en-US/index.aff', 'utf8');
    const dicData = fs.readFileSync('./dictionaries/en-US/index.dic', 'utf8');
    this.speller = nspell(affData, dicData);
  }

  checkText(text, customWords = []) {
    // Basic implementation
    const words = this.extractWords(text);
    const issues = [];

    for (const word of words) {
      if (!this.speller.correct(word) && !customWords.includes(word)) {
        issues.push({
          word,
          suggestions: this.speller.suggest(word),
          type: 'spelling',
          severity: 'error'
        });
      }
    }

    return { spelling: issues };
  }
}
```

#### Success Criteria

- [ ] Service starts successfully in Docker
- [ ] Health endpoint responds correctly
- [ ] Basic spell checking works for English text
- [ ] Integration with main backend functional
- [ ] Performance baseline established (target: <100ms for 1KB text)

---

### **Phase 2: Enhanced Capabilities (Week 3-4)**
*AI Agent Focus: Grammar, Style & Multi-language Support*

#### Deliverables:
- [ ] **Grammar Checking**: Retext integration with English grammar rules
- [ ] **Style Analysis**: Write-good integration for style suggestions
- [ ] **Multi-language Support**: 5+ languages with auto-detection
- [ ] **Language Detection**: Automatic language identification
- [ ] **Enhanced API**: Full response structure with all analysis types
- [ ] **Performance Optimization**: Caching and memory management

#### Implementation Details:
```javascript
// Phase 2 enhanced capabilities
const retext = require('retext');
const retextEnglish = require('retext-english');
const retextEquality = require('retext-equality');
const franc = require('franc');
const writeGood = require('write-good');

class EnhancedSpellChecker extends BasicSpellChecker {
  constructor() {
    super();
    this.languages = new Map(); // Cache multiple dictionaries
    this.grammarProcessor = retext()
      .use(retextEnglish)
      .use(retextEquality);
  }

  async detectLanguage(text) {
    const langCode = franc(text, { minLength: 10 });
    return this.mapLanguageCode(langCode);
  }

  async checkGrammar(text) {
    return new Promise((resolve) => {
      this.grammarProcessor.process(text, (err, file) => {
        const issues = file.messages.map(msg => ({
          message: msg.message,
          position: msg.position,
          type: 'grammar',
          severity: 'warning'
        }));
        resolve(issues);
      });
    });
  }

  checkStyle(text) {
    const suggestions = writeGood(text, {
      passive: true,
      illusion: true,
      weasel: true
    });

    return suggestions.map(s => ({
      message: s.reason,
      position: { start: s.index, end: s.index + s.offset },
      type: 'style',
      severity: 'suggestion'
    }));
  }
}
```

#### Success Criteria:
- [ ] Grammar checking identifies common issues
- [ ] Style analysis provides useful suggestions
- [ ] Language auto-detection >90% accurate
- [ ] 5+ languages supported with quality dictionaries
- [ ] Response time <200ms for 5KB text
- [ ] Memory usage optimized with dictionary caching

---

### **Phase 3: Advanced Features (Week 5-6)**
*AI Agent Focus: Contextual Analysis & Enterprise Features*

#### Deliverables:
- [ ] **Contextual Suggestions**: AI-enhanced word suggestions using context
- [ ] **Readability Analysis**: Multiple readability metrics
- [ ] **Custom Dictionaries**: User/organization custom word management
- [ ] **Style Guides**: Support for AP, Chicago, MLA style guides
- [ ] **Batch Processing**: Efficient handling of large documents
- [ ] **Performance Metrics**: Detailed analytics and monitoring

#### Implementation Details:
```javascript
// Phase 3 advanced features
const compromise = require('compromise');
const { readability } = require('retext-readability');

class AdvancedSpellChecker extends EnhancedSpellChecker {
  constructor() {
    super();
    this.contextAnalyzer = compromise;
    this.customDictionaries = new Map(); // User custom words
    this.styleGuides = this.loadStyleGuides();
  }

  async getContextualSuggestions(word, context, speller) {
    // Analyze surrounding context
    const doc = this.contextAnalyzer(context);
    const wordContext = doc.match(word).context();

    // Get basic suggestions
    const basicSuggestions = speller.suggest(word);

    // Enhance with context analysis
    const contextualSuggestions = this.analyzeContext(word, wordContext);

    // Merge and rank suggestions
    return this.rankSuggestions(basicSuggestions, contextualSuggestions);
  }

  analyzeReadability(text) {
    const stats = this.getTextStatistics(text);
    return {
      fleschKincaid: this.calculateFleschKincaid(stats),
      gunningFog: this.calculateGunningFog(stats),
      sentenceCount: stats.sentences,
      wordCount: stats.words,
      averageWordsPerSentence: stats.words / stats.sentences
    };
  }

  applyStyleGuide(text, guide = 'ap') {
    const rules = this.styleGuides[guide];
    const issues = [];

    for (const rule of rules) {
      const matches = text.match(rule.pattern);
      if (matches) {
        issues.push({
          message: rule.message,
          suggestion: rule.suggestion,
          type: 'style',
          severity: 'suggestion',
          rule: rule.name
        });
      }
    }

    return issues;
  }
}
```

#### Success Criteria:
- [ ] Contextual suggestions improve word choice accuracy by 30%
- [ ] Readability metrics match industry standards
- [ ] Custom dictionary management fully functional
- [ ] Style guide compliance checking implemented
- [ ] Batch processing handles 100KB+ documents efficiently
- [ ] Comprehensive performance monitoring in place

---

### **Phase 4: Integration & Optimization (Week 7-8)**
*AI Agent Focus: Frontend Integration & Performance Tuning*

#### Deliverables:
- [ ] **Frontend Integration**: Update SpellCheckService to use backend
- [ ] **Migration Strategy**: Gradual rollout with feature flags
- [ ] **Performance Optimization**: Sub-100ms response times
- [ ] **Error Handling**: Comprehensive error management
- [ ] **Monitoring**: Health checks and performance metrics
- [ ] **Documentation**: Complete API documentation and guides

#### Implementation Details:
```javascript
// Frontend integration updates
// frontend/src/services/editor/SpellCheckService.js

export class BackendSpellCheckService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_SPELL_CHECK_URL || 'http://localhost:8003';
    this.fallbackToLocal = true; // Feature flag for gradual migration
  }

  async scan(text, onProgress = () => {}, categoryId = null, folderPath = null) {
    try {
      // Get custom words for context
      const customWords = DictionaryService.getAllApplicableWords(folderPath, categoryId);

      // Call backend service
      const response = await fetch(`${this.baseUrl}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          options: {
            enableSpelling: true,
            enableGrammar: true,
            enableStyle: true,
            customWords,
            ignoreCodeBlocks: true,
            contextualSuggestions: true
          }
        })
      });

      const result = await response.json();

      // Transform backend response to frontend format
      return this.transformBackendResponse(result);

    } catch (error) {
      console.warn('Backend spell check failed, falling back to local:', error);

      if (this.fallbackToLocal) {
        // Fallback to existing browser implementation
        return super.scan(text, onProgress, categoryId, folderPath);
      }

      throw error;
    }
  }

  transformBackendResponse(backendResult) {
    const issues = [];

    // Transform spelling issues
    backendResult.results.spelling?.forEach(issue => {
      issues.push({
        word: issue.word,
        suggestions: issue.suggestions,
        lineNumber: issue.line,
        column: issue.column,
        offset: issue.position.start,
        type: 'spelling'
      });
    });

    // Transform grammar issues
    backendResult.results.grammar?.forEach(issue => {
      issues.push({
        word: issue.message,
        suggestions: [issue.suggestion],
        offset: issue.position.start,
        type: 'grammar'
      });
    });

    return issues;
  }
}
```

#### Success Criteria:
- [ ] Frontend seamlessly integrates with backend service
- [ ] Feature flag system enables gradual user migration
- [ ] Performance meets or exceeds browser implementation
- [ ] Error handling provides smooth fallback experience
- [ ] Monitoring dashboard shows service health
- [ ] User experience identical or improved

---

### **Phase 5: Production & Optimization (Week 9-10)**
*AI Agent Focus: Production Deployment & Monitoring*

#### Deliverables:
- [ ] **Production Deployment**: Systemd service configuration
- [ ] **Load Testing**: Performance validation under load
- [ ] **Monitoring Dashboard**: Service health and performance metrics
- [ ] **User Migration**: Gradual rollout to user base
- [ ] **Performance Tuning**: Final optimizations based on real usage
- [ ] **Documentation**: Complete operational documentation

#### Production Configuration:
```yaml
# docker-compose.yml production configuration
spell-check-service:
  build: ./spell-check-service
  restart: unless-stopped
  ports:
    - "8003:8003"
  volumes:
    - ./spell-check-service/dictionaries:/app/dictionaries:ro
    - ./spell-check-service/config:/app/config:ro
    - spell-check-cache:/app/cache
  environment:
    - NODE_ENV=production
    - SPELL_CHECK_PORT=8003
    - CACHE_SIZE=512MB
    - MAX_TEXT_SIZE=1MB
    - ENABLE_PERFORMANCE_LOGGING=true
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8003/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  deploy:
    resources:
      limits:
        memory: 1GB
        cpus: '1.0'
      reservations:
        memory: 512MB
        cpus: '0.5'
```

#### Monitoring Implementation:
```javascript
// Enhanced monitoring and metrics
const prometheus = require('prom-client');

// Metrics collection
const requestDuration = new prometheus.Histogram({
  name: 'spell_check_request_duration_seconds',
  help: 'Duration of spell check requests',
  labelNames: ['language', 'text_size_kb']
});

const requestCount = new prometheus.Counter({
  name: 'spell_check_requests_total',
  help: 'Total number of spell check requests',
  labelNames: ['language', 'status']
});

const errorRate = new prometheus.Counter({
  name: 'spell_check_errors_total',
  help: 'Total number of spell check errors',
  labelNames: ['error_type']
});

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const textSize = Math.ceil((req.body?.text?.length || 0) / 1024);

    requestDuration
      .labels(req.body?.language || 'auto', textSize.toString())
      .observe(duration);

    requestCount
      .labels(req.body?.language || 'auto', res.statusCode >= 400 ? 'error' : 'success')
      .inc();
  });

  next();
});
```

#### Success Criteria:
- [ ] Service deployed and stable in production
- [ ] Load testing shows acceptable performance under 100+ concurrent users
- [ ] Monitoring dashboard provides actionable insights
- [ ] 50%+ users migrated successfully with positive feedback
- [ ] Performance optimizations reduce response times by 20%
- [ ] Complete operational runbooks documented

---

## 📊 Performance Targets & Success Metrics

### Technical Performance
| Metric | Current (Browser) | Target (Backend) | Measurement |
|--------|------------------|------------------|-------------|
| Dictionary Load Time | 2-5 seconds | 0ms (pre-loaded) | Service startup |
| Small Text (1KB) | 200-500ms | <100ms | 95th percentile |
| Medium Text (10KB) | 1-3 seconds | <300ms | 95th percentile |
| Large Text (100KB) | 10-30 seconds | <2 seconds | 95th percentile |
| Memory Usage | 50-300MB (6 workers) | <100MB | Service total |
| Bundle Size Impact | +600KB | 0KB | Frontend bundle |

### Feature Capabilities
| Feature | Current | Target | Implementation |
|---------|---------|--------|----------------|
| Spell Checking | ✅ Basic | ✅ Enhanced | nspell + custom dictionaries |
| Grammar Checking | ❌ None | ✅ Advanced | retext + custom rules |
| Style Analysis | ❌ None | ✅ Professional | write-good + style guides |
| Multi-language | ❌ EN only | ✅ 10+ languages | Auto-detection + dictionaries |
| Context Awareness | ❌ None | ✅ AI-enhanced | NLP + context analysis |
| Custom Dictionaries | ✅ Basic | ✅ Enterprise | Scoped word management |

### User Experience Metrics
- **Response Time**: <100ms perceived (with proper loading states)
- **Accuracy**: 95%+ spell check accuracy (vs 85% current)
- **Feature Adoption**: 80%+ users engage with grammar/style features
- **Error Rate**: <1% service errors with graceful fallback
- **User Satisfaction**: >4.5/5 rating for writing assistance features

---

## 🔧 Development Guidelines for AI Agents

### Code Standards
```javascript
// File headers for AI agent tracking
/**
 * Backend Spell Check Service
 * Phase: [1-5] - [Phase Name]
 * Created: [Date] by AI Agent [ID]
 * Purpose: [Specific functionality]
 * Dependencies: [Key dependencies]
 * Integration: [Integration points]
 */
```

### Testing Requirements
```javascript
// Test structure for each phase
describe('Phase [N] - [Feature Name]', () => {
  describe('Core Functionality', () => {
    // Basic feature tests
  });

  describe('Performance', () => {
    // Performance benchmarks
  });

  describe('Integration', () => {
    // Integration with existing systems
  });

  describe('Error Handling', () => {
    // Error scenarios and fallbacks
  });
});
```

### Documentation Standards
Each phase must include:
- [ ] **API Documentation**: OpenAPI/Swagger specifications
- [ ] **Implementation Notes**: Design decisions and trade-offs
- [ ] **Performance Benchmarks**: Before/after measurements
- [ ] **Integration Guide**: How to integrate with existing systems
- [ ] **Troubleshooting**: Common issues and solutions

### Handoff Protocol
When completing a phase:
1. **Update Progress**: Mark phase completion in this document
2. **Document Issues**: Any blockers or deviations from plan
3. **Performance Data**: Actual vs target metrics
4. **Next Steps**: Recommendations for following AI agent
5. **Code Review**: Ensure code meets project standards

---

## 🚦 Risk Management & Mitigation

### Technical Risks
| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Performance Degradation | Medium | High | Comprehensive benchmarking, gradual rollout |
| Memory Leaks | Low | High | Extensive testing, monitoring, auto-restart |
| Dictionary Licensing | Low | Medium | Use MIT/Apache licensed dictionaries |
| Integration Complexity | Medium | Medium | Maintain backward compatibility, feature flags |

### Operational Risks
| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Service Downtime | Low | High | Health checks, auto-restart, fallback to browser |
| Resource Exhaustion | Medium | Medium | Resource limits, horizontal scaling |
| Deployment Issues | Medium | Low | Staged deployment, rollback procedures |

### User Experience Risks
| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Feature Regression | Medium | High | Comprehensive testing, A/B testing |
| Performance Perception | Low | Medium | Loading states, perceived performance optimization |
| Learning Curve | Low | Low | Gradual feature introduction, documentation |

---

## 📈 Business Impact & ROI

### Development Cost Analysis
- **Phase 1-2**: Foundation + Core Features (40 hours)
- **Phase 3-4**: Advanced Features + Integration (30 hours)
- **Phase 5**: Production + Optimization (20 hours)
- **Total Estimated**: 90 AI agent hours across 10 weeks

### Expected Benefits
1. **Performance Improvement**: 10-100x faster processing
2. **Feature Enhancement**: Grammar + style checking (new revenue opportunities)
3. **User Experience**: Professional writing assistance features
4. **Technical Debt Reduction**: Eliminate complex browser worker management
5. **Scalability**: Support for enterprise customers with custom requirements

### Success Indicators
- **Technical**: Sub-100ms response times, >99.9% uptime
- **User**: >4.5/5 satisfaction rating, 80%+ feature adoption
- **Business**: Enable enterprise features, reduce support tickets
- **Operational**: Simplified deployment, better monitoring

---

## 🎯 Next Steps for AI Agent Implementation

### Immediate Actions (Phase 1 - Week 1)
1. **Create Service Structure**: Initialize spell-check-service directory
2. **Basic Server Setup**: Express server with health endpoint
3. **Docker Integration**: Add service to docker-compose.yml
4. **Dictionary Setup**: Download and configure en-US Hunspell dictionary
5. **Basic API**: Implement simple `/check` endpoint

### Key Integration Points
- **Backend Service**: `backend/app/services/spell_check_service.py`
- **Frontend Service**: `frontend/src/services/editor/SpellCheckService.js`
- **Docker Compose**: Add spell-check-service configuration
- **Nginx Config**: Add proxy rules for spell check service

### Success Checkpoints
- **Phase 1**: Basic service functional
- **Phase 2**: Feature parity with browser implementation
- **Phase 3**: Advanced features demonstrable
- **Phase 4**: Production-ready with monitoring
- **Phase 5**: Full user migration completed

---

**AI Agent Instructions**: This proposal provides a comprehensive roadmap for implementing a production-grade backend spell check service. Each phase builds incrementally while maintaining system stability. Follow the established patterns from `markdown-lint-service` and integrate with the existing architecture. Prioritize performance, reliability, and user experience throughout development.

**Documentation Updates**: Update this document after each phase completion with actual implementation details, performance measurements, and lessons learned for future AI agents.
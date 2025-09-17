# Debug Tools

This directory contains debugging utilities for the Markdown Manager application.

## Dictionary Integration Debug Script

### `debug-dictionary-integration.js`

A comprehensive debugging tool for testing the spell check dictionary integration.

**Usage:**

1. Copy the script content to your browser console while the app is running
2. Run `window.runDictionaryDebug()` for a complete test suite
3. Or run individual test functions:
   - `window.checkServices()` - Check if services are available
   - `window.checkUserWords()` - Check user dictionary words
   - `window.testWordAddition()` - Test adding words to dictionary
   - `window.testSpellCheckService()` - Test spell check integration
   - `window.testBackendSync()` - Test backend synchronization

**What it tests:**

- Service availability (DictionaryService, SpellCheckService)
- User dictionary word management
- Spell check integration with custom words
- Backend synchronization
- LocalStorage persistence
- End-to-end workflow

**Example output:**

```console
=== Dictionary Integration Debug ===
✅ DictionaryService available
✅ SpellCheckService available
User dictionary words: ["testword", "customterm"]
✅ Test word was correctly ignored by spell checker
```

This tool was used to identify and fix issues with the dictionary integration where custom words weren't being properly incorporated into the spell checking engine.

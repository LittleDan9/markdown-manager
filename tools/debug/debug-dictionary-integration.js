// Debug script to test dictionary integration
// Run this in the browser console to check dictionary state

console.log('=== Dictionary Integration Debug ===');

// Check if services are available
const checkServices = () => {
  console.log('\n--- Checking Service Availability ---');
  
  if (typeof window !== 'undefined' && window.DictionaryService) {
    console.log('✅ DictionaryService available');
  } else {
    console.log('❌ DictionaryService not available - app might still be loading');
    return false;
  }
  
  if (typeof window !== 'undefined' && window.SpellCheckService) {
    console.log('✅ SpellCheckService available');
  } else {
    console.log('❌ SpellCheckService not available - app might still be loading');
  }
  
  return true;
};

// Check current user words
const checkUserWords = () => {
  console.log('\n--- Checking User Dictionary ---');
  
  try {
    const userWords = DictionaryService.getCustomWords();
    console.log('User dictionary words:', userWords);
    console.log('User word count:', userWords.length);
    return userWords;
  } catch (error) {
    console.error('Error getting user words:', error);
    return [];
  }
};

// Check applicable words for spell checking
const checkApplicableWords = () => {
  console.log('\n--- Checking Applicable Words for Spell Check ---');
  
  try {
    // Test with no category/folder
    const globalWords = DictionaryService.getAllApplicableWords();
    console.log('Global applicable words:', globalWords);
    
    // Test with a folder path
    const folderWords = DictionaryService.getAllApplicableWords('/test');
    console.log('Folder "/test" applicable words:', folderWords);
    
    // Test with a category ID
    const categoryWords = DictionaryService.getAllApplicableWords(null, 1);
    console.log('Category "1" applicable words:', categoryWords);
    
    return { globalWords, folderWords, categoryWords };
  } catch (error) {
    console.error('Error getting applicable words:', error);
    return { globalWords: [], folderWords: [], categoryWords: [] };
  }
};

// Test adding a word and checking if it's applied
const testWordAddition = () => {
  console.log('\n--- Testing Word Addition ---');
  
  const testWord = 'debugtestword';
  
  try {
    // Add word to user dictionary
    DictionaryService.addCustomWord(testWord);
    console.log(`✅ Added "${testWord}" to user dictionary`);
    
    // Check if it's in user words
    const userWords = DictionaryService.getCustomWords();
    const isInUserWords = userWords.includes(testWord);
    console.log(`Word in user dictionary: ${isInUserWords}`);
    
    // Check if it's in applicable words
    const applicableWords = DictionaryService.getAllApplicableWords();
    const isInApplicableWords = applicableWords.includes(testWord);
    console.log(`Word in applicable words: ${isInApplicableWords}`);
    
    return { testWord, isInUserWords, isInApplicableWords };
  } catch (error) {
    console.error('Error testing word addition:', error);
    return { testWord, isInUserWords: false, isInApplicableWords: false };
  }
};

// Test spell check service directly
const testSpellCheckService = async () => {
  console.log('\n--- Testing SpellCheck Service ---');
  
  try {
    if (!window.SpellCheckService) {
      console.log('❌ SpellCheckService not available');
      return;
    }
    
    // Get custom words from spell check service
    const spellCheckWords = SpellCheckService.getCustomWords();
    console.log('SpellCheck service custom words:', spellCheckWords);
    
    // Test a sample text with a known custom word
    const testText = 'This is a debugtestword that should not be flagged.';
    console.log('Testing spell check on:', testText);
    
    // Note: This will be async and return Promise
    const issues = await SpellCheckService.scan(testText);
    console.log('Spell check issues found:', issues);
    
    // Check if our test word was flagged
    const testWordFlagged = issues.some(issue => issue.word === 'debugtestword');
    console.log(`Test word flagged as error: ${testWordFlagged}`);
    
    return { spellCheckWords, issues, testWordFlagged };
  } catch (error) {
    console.error('Error testing spell check service:', error);
    return { spellCheckWords: [], issues: [], testWordFlagged: null };
  }
};

// Test localStorage state
const checkLocalStorage = () => {
  console.log('\n--- Checking LocalStorage ---');
  
  try {
    const customDictionary = localStorage.getItem('customDictionary');
    console.log('localStorage customDictionary:', customDictionary);
    
    if (customDictionary) {
      const parsedDict = JSON.parse(customDictionary);
      console.log('Parsed custom dictionary:', parsedDict);
      console.log('Count:', parsedDict.length);
    }
    
    return customDictionary;
  } catch (error) {
    console.error('Error checking localStorage:', error);
    return null;
  }
};

// Test backend sync
const testBackendSync = async () => {
  console.log('\n--- Testing Backend Sync ---');
  
  try {
    console.log('Attempting to sync with backend...');
    const result = await DictionaryService.syncAfterLogin();
    console.log('Backend sync result:', result);
    return result;
  } catch (error) {
    console.error('Error syncing with backend:', error);
    return null;
  }
};

// Run all tests
const runDictionaryDebug = async () => {
  console.log('Starting dictionary integration debug...');
  
  const servicesAvailable = checkServices();
  if (!servicesAvailable) {
    console.log('❌ Required services not available. Wait for app to load or refresh the page.');
    return;
  }
  
  const userWords = checkUserWords();
  const applicableWords = checkApplicableWords();
  const wordTest = testWordAddition();
  const localStorage = checkLocalStorage();
  
  console.log('\n--- Summary Before Spell Check Test ---');
  console.log('User words count:', userWords.length);
  console.log('Test word added successfully:', wordTest.isInUserWords && wordTest.isInApplicableWords);
  
  // Test spell check service
  const spellCheckTest = await testSpellCheckService();
  
  // Test backend sync
  const backendSync = await testBackendSync();
  
  console.log('\n--- Final Analysis ---');
  console.log('🔍 Potential Issues:');
  
  if (userWords.length === 0) {
    console.log('⚠️  No user words found - check if dictionary sync worked');
  }
  
  if (wordTest.isInUserWords && !wordTest.isInApplicableWords) {
    console.log('⚠️  Word added to user dictionary but not appearing in applicable words');
  }
  
  if (spellCheckTest && spellCheckTest.spellCheckWords.length !== applicableWords.globalWords.length) {
    console.log('⚠️  Mismatch between spell check service words and dictionary service words');
    console.log(`   SpellCheck: ${spellCheckTest.spellCheckWords.length}, Dictionary: ${applicableWords.globalWords.length}`);
  }
  
  if (spellCheckTest && spellCheckTest.testWordFlagged === true) {
    console.log('❌ Test word was flagged as error despite being in dictionary!');
  } else if (spellCheckTest && spellCheckTest.testWordFlagged === false) {
    console.log('✅ Test word was correctly ignored by spell checker');
  }
  
  console.log('\n=== Debug Complete ===');
  
  return {
    servicesAvailable,
    userWords,
    applicableWords,
    wordTest,
    localStorage,
    spellCheckTest,
    backendSync
  };
};

// Make it available globally for testing
window.runDictionaryDebug = runDictionaryDebug;
window.checkServices = checkServices;
window.checkUserWords = checkUserWords;
window.checkApplicableWords = checkApplicableWords;
window.testWordAddition = testWordAddition;
window.testSpellCheckService = testSpellCheckService;
window.checkLocalStorage = checkLocalStorage;
window.testBackendSync = testBackendSync;

console.log('📋 Dictionary debug functions loaded. Run window.runDictionaryDebug() to start.');
console.log('📋 Individual tests: checkServices, checkUserWords, testWordAddition, testSpellCheckService, etc.');
// Test script to verify dictionary functionality
console.log('Testing Dictionary Functionality...');

// Test 1: Check if DictionaryService is available
try {
  console.log('✓ Starting dictionary tests');

  // This would be run in browser console
  console.log('To test dictionary functionality, run these commands in browser console:');
  console.log('');
  console.log('// Test adding words to category dictionary');
  console.log('window.testCategoryDictionary = function() {');
  console.log('  const DictionaryService = window.DictionaryService;');
  console.log('  if (!DictionaryService) {');
  console.log('    console.error("DictionaryService not available");');
  console.log('    return;');
  console.log('  }');
  console.log('  ');
  console.log('  // Add a word to General category');
  console.log('  DictionaryService.addCategoryWord("General", "testword");');
  console.log('  console.log("Category words:", DictionaryService.getCategoryWords("General"));');
  console.log('  ');
  console.log('  // Add a word to personal dictionary');
  console.log('  DictionaryService.addCustomWord("personalword");');
  console.log('  console.log("Personal words:", DictionaryService.getCustomWords());');
  console.log('  ');
  console.log('  // Test combined words');
  console.log('  console.log("All applicable words for General:", DictionaryService.getAllApplicableWords("General"));');
  console.log('};');
  console.log('');
  console.log('window.testCategoryDictionary();');

} catch (error) {
  console.error('❌ Error in dictionary test:', error);
}

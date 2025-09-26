// Quick test to set the auth token in localStorage for testing GitHub file content loading
// Run this in the browser console to set your JWT token

console.log('🔧 Setting auth token for testing...');

// Your JWT token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYW5AbGl0dGxlZGFuLmNvbSIsImV4cCI6MTc1ODY5MTQ2OH0.s2HiBeoXcLMFG6qUPpnei5BIHFdAEDglY05uOYmfQ_Y';

// Set the token
localStorage.setItem('authToken', token);

console.log('✅ Token set! Now try opening a GitHub file.');
console.log('🔍 Token preview:', token.substring(0, 20) + '...');

// Test API call
fetch('/api/github/repositories/393/file?file_path=README.md&branch=main', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ API Test successful! Content length:', data.content?.length || 0);
  console.log('📄 Content preview:', data.content?.substring(0, 100) + '...');
})
.catch(error => {
  console.error('❌ API Test failed:', error);
});
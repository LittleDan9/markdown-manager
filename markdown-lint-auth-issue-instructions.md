# Markdown Linting Authentication & Performance Issue

## 🎯 Issue Summary

**Primary Issues:**
1. **Markdown linting requires authentication** when it should be publicly accessible
2. **Rapid/frequent API calls** for both markdown linting and spell checking services
3. **403 Forbidden errors** cluttering console for markdown lint endpoints

**Secondary Issue:**
- Spell check is also calling too frequently but NOT getting 403 errors (auth working correctly there)

## 📊 Current Error Log Evidence

```
GET http://localhost/api/markdown-lint/user/defaults 403 (Forbidden)
POST http://localhost/api/markdown-lint/process 403 (Forbidden)
[ERROR] API Error: {message: 'Request failed with status code 403', status: 403, statusText: 'Forbidden'}
[WARN] Failed to get effective rules, falling back to defaults: Error: Not authenticated
```

## 🔍 Investigation Tasks

### Task 1: Backend Authentication Analysis

**Check these backend files:**
- `backend/app/routes/` - Look for markdown-lint route definitions
- `backend/app/middleware/` - Check authentication middleware
- `backend/app/api/` - API endpoint configurations

**Questions to answer:**
1. Are `/api/markdown-lint/user/defaults` and `/api/markdown-lint/process` endpoints requiring authentication?
2. Should these endpoints be public for basic functionality?
3. Is there inconsistency between spell check auth (working) and markdown lint auth (failing)?

**Commands to run:**
```bash
# Find markdown lint route definitions
grep -r "markdown-lint" backend/app --include="*.py" -A 5 -B 5

# Check auth middleware usage
grep -r "@auth\|@login_required\|@jwt_required" backend/app --include="*.py" | grep -i lint

# Compare with spell check routes (working example)
grep -r "spell" backend/app --include="*.py" | grep -i route
```

### Task 2: Frontend Frequency Analysis

**Check these frontend files:**
- `frontend/src/hooks/editor/useEditorMarkdownLint.js`
- `frontend/src/hooks/editor/useEditorSpellCheck.js`
- `frontend/src/services/editor/MarkdownLintService.js`
- `frontend/src/api/lintingApi.js`

**Questions to answer:**
1. What triggers are causing frequent markdown lint calls?
2. What are the debounce delays and periodic check intervals?
3. Why is spell check calling frequently but markdown lint getting 403s?

**Look for these patterns:**
```javascript
setInterval(...)     // Periodic checks
setTimeout(...)      // Debounced calls
debounce(...)        // Debounce logic
onDidChangeModelContent  // Editor change handlers
```

### Task 3: Service Comparison

**Compare working vs broken:**
- **Spell Check** (working, frequent but no 403): How does it handle auth?
- **Markdown Lint** (broken, frequent with 403): What's different?

**Key files to compare:**
```
frontend/src/api/spellCheckApi.js  (if exists)
frontend/src/api/lintingApi.js
frontend/src/services/editor/SpellCheckService.js
frontend/src/services/editor/MarkdownLintService.js
```

## 🎯 Expected Solutions

### Solution 1: Fix Authentication

**Option A: Make endpoints public**
- Remove auth requirements from basic markdown lint endpoints
- Keep auth only for user-specific settings/configs

**Option B: Fix authentication flow**
- Ensure markdown lint service includes proper auth headers
- Match the pattern used by spell check service

### Solution 2: Reduce Call Frequency

**For both spell check and markdown lint:**
- Increase debounce delays (currently might be too aggressive)
- Reduce periodic check frequency
- Add rate limiting to prevent rapid successive calls
- Consider user activity-based triggering vs. time-based

**Current timing to investigate:**
```javascript
// Look for these in the hook files:
- debounce delays (should be 2000ms+ for typing)
- setInterval periods (should be 60000ms+ for periodic)
- setTimeout delays (should be reasonable)
```

## 📋 Investigation Checklist

### Backend Investigation
- [ ] Identify all markdown-lint API endpoints
- [ ] Check which endpoints require authentication
- [ ] Compare with spell-check endpoint auth patterns
- [ ] Determine if auth requirement is intentional or bug

### Frontend Investigation
- [ ] Map all markdown lint API call triggers
- [ ] Document current debounce/timing settings
- [ ] Compare spell check vs markdown lint service patterns
- [ ] Identify why calls are so frequent

### Performance Analysis
- [ ] Count actual API calls per minute during normal editing
- [ ] Determine optimal call frequency for user experience
- [ ] Check for duplicate/redundant service calls

## 🛠️ Files to Modify (Likely)

### Backend (Authentication Fix)
- Route definitions for markdown-lint endpoints
- Authentication middleware configuration
- API endpoint auth decorators

### Frontend (Frequency Fix)
- `useEditorMarkdownLint.js` - timing logic
- `useEditorSpellCheck.js` - timing logic
- Service classes - debounce configurations
- API clients - request throttling

## 🎯 Success Criteria

1. **No 403 errors** for markdown linting during normal editing
2. **Reasonable API call frequency** (max 1-2 calls per 10 seconds during active editing)
3. **Consistent behavior** between spell check and markdown lint services
4. **Maintained functionality** for both authenticated and unauthenticated users

## 📝 Testing Instructions

After fixes:
1. Open editor without authentication
2. Type normally for 60 seconds
3. Monitor network tab - should see reasonable API call frequency
4. Verify no 403 errors in console
5. Test that both services still work correctly when authenticated

## 🔧 Debug Commands

```bash
# Real-time API monitoring
# Open browser dev tools → Network tab → filter by "lint" or "spell"

# Backend logs
docker compose logs backend | grep -i "lint\|auth"

# Frontend console filtering
# In browser console: filter by "lint", "spell", "403", "auth"
```

---

**Priority:** High (affects user experience with console errors and potential performance)
**Complexity:** Medium (likely configuration/timing issue rather than architectural)
**Estimated Time:** 2-4 hours including testing
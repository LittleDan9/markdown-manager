# AI Provider Preference Hydration from Platform AI

## Problem

The chat drawer initializes provider/model selection from `localStorage` (`chat_provider`, `chat_model`). This causes stale key IDs to persist across deployments — e.g., old integer IDs from the local key store survive after migrating to Platform AI UUIDs. The user must manually clear localStorage to fix.

## Current Flow (MM `ChatDrawer.jsx`)

1. **Init**: Read `localStorage('chat_provider')` → `{ provider, keyId }`
2. **Drawer open**: Fetch keys from `/platform-keys`, build `availableProviders`
3. **Validate**: If saved `keyId` not in `availableProviders`, fall back to Ollama
4. **Persist**: On change, write to `localStorage`

### Problem

Step 3 validation runs as a separate `useEffect` after `availableProviders` updates, but the chat request can fire before the fallback effect runs — using the stale keyId from the initial state.

## Proposed Fix

### Phase 1: Hydrate from Platform AI Preferences (server-side source of truth)

The `/api/ai/preferences` endpoint already stores per-user per-app preferences (`preferred_provider`, `preferred_model`, `preferred_key_id`). Use this as the authoritative source:

```
Drawer opens →
  1. Fetch /api/ai/preferences (parallel with /platform-keys)
  2. If preferences exist and key is valid → use them
  3. Else if localStorage has valid selection → use that
  4. Else → fall back to Ollama
```

#### Files to change (MM):
- `services/ui/src/components/chat/ChatDrawer.jsx`
  - Import `aiPreferencesApi`
  - In the drawer-open useEffect, fetch preferences alongside keys
  - After `availableProviders` is built, resolve initial selection: preferences → localStorage → default
  - On provider/model change, call `aiPreferencesApi.savePreferences()` (debounced)
  - Remove or demote localStorage to a fast-path cache only

#### Files to change (TM):
- `frontend/src/components/ai/AIChatDrawer.jsx`
  - Same pattern: fetch `/ai/preferences` on open, use as source of truth
  - On selection change, save back to Platform AI

### Phase 2: Remove localStorage dependency entirely

Once Platform AI preferences are the source of truth:
- Remove `chat_provider` / `chat_model` localStorage reads/writes
- Preferences load is fast enough (~50ms from the proxy) to not need a local cache
- Eliminates all stale-cache bugs permanently

## API Reference

### GET /api/ai/preferences
Returns: `{ preferred_provider, preferred_model, preferred_key_id }` or `{}` if not set.

### PUT /api/ai/preferences
Body: `{ preferred_provider?, preferred_model?, preferred_key_id? }`
Saves per-user per-app preference in Platform AI.

## Affected Components

| App | Component | Current Source | Target Source |
|-----|-----------|---------------|--------------|
| MM | `ChatDrawer.jsx` | localStorage | Platform AI preferences |
| TM | `AIChatDrawer.jsx` | localStorage + local DB settings | Platform AI preferences |
| Both | `aiPreferencesApi.js` / `aiPreferences.js` | Already exists | No change needed |

## Risk

Low — the preferences endpoint already exists and is proxied. The change is purely frontend initialization logic.

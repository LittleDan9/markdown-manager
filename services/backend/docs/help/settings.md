# Settings & Preferences

Configure your Markdown Manager experience through the Settings modal and toolbar toggles.

## Accessing Settings

Open the user menu (top-right) and click **Settings**. The Settings modal has a sidebar with these sections:

## Profile Info

- View and edit your display name and email address

## Security

### Change Password
Enter your current password and a new password to update your credentials.

### Two-Factor Authentication (MFA)

Enable TOTP-based two-factor authentication for extra security:

1. Click **Enable MFA**
2. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
3. Enter the 6-digit code from your app to verify
4. Confirm your password
5. Save the backup codes shown — store them securely

**Backup Codes**: View, download as a text file, print, or regenerate your backup codes (requires TOTP verification).

**Disable MFA**: Requires both your current password and a valid TOTP code.

## Dictionary

Manage custom dictionary entries for spell check:

- Add words to your **personal dictionary** (applies to all documents) or a **category-scoped dictionary** (applies only to documents in that category)
- Remove words you've previously added
- Custom words are excluded from spell check results

## Linting

Configure markdown linting rules:

- **Enable/disable** markdown linting globally
- Toggle individual rules (MD001 through MD058), organized by category: Headings, Lists, Spacing, Links & Images, Code, Style, Tables
- **Enable/disable all** rules in a category at once
- **Import/export** your lint rule configuration for backup or sharing

## Spell Check

Configure the spell check and grammar analysis system:

- **Analysis types** — toggle: Spelling, Grammar, Style, Readability
- **Grammar rules** — enable/disable individual grammar rules and adjust thresholds
- **Style settings** — configure style checking preferences
- **Language** — select your language (e.g., en-US, en-GB) or enable auto-detection
- **Style guide** — choose a style guide for consistency checking
- **Code Spell Check** — enable spell checking inside code blocks; configure what to check (Comments, Strings, Identifiers) and which languages are supported

## Display

- **Document tab position** — place tabs above or below the editor
- **Tab sort order** — choose how tabs are sorted (alphabetical, by last modified, etc.)
- **Recents tab limit** — set how many recent files appear in the Recent Files list (1–25)

## Storage

View your storage usage for documents and images.

## AI Providers

Configure API keys for cloud-based AI providers:

| Provider | Fields |
|---|---|
| **OpenAI** | API key, label, preferred model, base URL override |
| **xAI (Grok)** | API key, label, preferred model |
| **GitHub Models** | API key, label, preferred model, organization name (for rate limits) |
| **Google Gemini** | API key, label, preferred model |

For each key, you can:
- **Test** connectivity (validates the key against the provider)
- **Add**, **Update**, or **Delete** keys
- Set a **preferred model** from the provider's available models

**Ollama** (local AI) requires no API key — it's always available as the default provider.

## Toolbar Preferences

These are toggled directly from the user menu without opening Settings:

| Setting | Description |
|---|---|
| **Autosave** | Automatically save documents at regular intervals |
| **Sync Preview Scroll** | Link editor and preview scrolling so they stay in sync |
| **Auto-commit on Session Close** | Automatically commit changes to Git when you close the app |
| **Light / Dark Theme** | Switch between light and dark mode |

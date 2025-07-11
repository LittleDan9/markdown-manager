import config from "../config";

export async function highlightSyntax(code, language) {
  try {
    const response = await fetch(`${config.apiBaseUrl}/highlight/syntax`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: code, language: language, tokens: "prism" }),
    });
    if (!response.ok) throw new Error("Highlighting API error");
    const data = await response.json();
    return data.highlighted_code || code;
  } catch (err) {
    console.warn("Syntax highlighting failed:", err);
    return code;
  }
}

export async function isLanguageSupported(language) {
  try {
    const response = await fetch(`${config.apiBase}/highlight/languages/${encodeURIComponent(language)}/check`);
    if (!response.ok) return false
    const data = await response.json();
    return data.languages || {};
  } catch (err) {
    console.warn("Failed to get highlight languages:", err);
    return false;
  }
}

export async function getAvailableLanguages() {
  try {
    const response = await fetch(`${config.apiBase}/highlight/languages`);
    if (!response.ok) throw new Error("Failed to fetch languages");
    const data = await response.json();
    return data.languages || {};
  } catch (err) {
    console.warn("Failed to get available languages:", err);
    return {};
  }
}

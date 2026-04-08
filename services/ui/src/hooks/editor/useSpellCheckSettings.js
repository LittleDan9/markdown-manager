import { useState, useEffect, useCallback, useRef } from 'react';
import spellCheckApi from '@/api/spellCheckApi';
import spellCheckSettingsApi from '@/api/spellCheckSettingsApi';

const STYLE_GUIDES = [
  { id: 'none', name: 'None', description: 'No specific style guide' },
  { id: 'ap', name: 'AP Style', description: 'Associated Press Stylebook' },
  { id: 'chicago', name: 'Chicago Manual', description: 'Chicago Manual of Style' },
  { id: 'mla', name: 'MLA', description: 'Modern Language Association' },
  { id: 'apa', name: 'APA', description: 'American Psychological Association' },
  { id: 'academic', name: 'Academic', description: 'General academic writing' },
  { id: 'technical', name: 'Technical', description: 'Technical documentation' }
];

export function useSpellCheckSettings({
  show,
  settings = {},
  onSettingsChange = () => {},
  currentUser = null
}) {
  // Analysis type toggles
  const [analysisTypes, setAnalysisTypes] = useState({
    spelling: settings.spelling ?? true,
    grammar: settings.grammar ?? true,
    style: settings.style ?? true,
    readability: settings.readability ?? true
  });

  // Code fence spell checking settings
  const [codeSpellSettings, setCodeSpellSettings] = useState({
    enabled: settings.enableCodeSpellCheck ?? false,
    checkComments: settings.codeSpellSettings?.checkComments ?? true,
    checkStrings: settings.codeSpellSettings?.checkStrings ?? false,
    checkIdentifiers: settings.codeSpellSettings?.checkIdentifiers ?? true
  });

  // Style guide selection
  const [selectedStyleGuide, setSelectedStyleGuide] = useState(
    settings.styleGuide || 'none'
  );

  // Language selection
  const [selectedLanguage, setSelectedLanguage] = useState(
    settings.language || 'en-US'
  );

    // Available languages from service
  const [availableLanguages, setAvailableLanguages] = useState(['en-US']);
  const [supportedCodeLanguages, setSupportedCodeLanguages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Language auto-detection
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(
    settings.autoDetectLanguage ?? false
  );
  const [detectedLanguage, setDetectedLanguage] = useState(null);

  // Grammar rule toggles
  const [grammarRules, setGrammarRules] = useState({
    sentenceLength: true,
    passiveVoice: true,
    repeatedWords: true,
    capitalization: true,
    punctuation: true,
    maxSentenceWords: 30,
    ...(settings.grammarRules || {})
  });

  // Style analyzer settings
  const [styleSettings, setStyleSettings] = useState({
    passive: true,
    illusion: true,
    so: true,
    thereIs: true,
    weasel: true,
    adverb: true,
    tooWordy: true,
    cliches: true,
    eprime: false,
    ...(settings.styleSettings || {})
  });

  const saveTimerRef = useRef(null);

  const loadStoredSettings = useCallback(async () => {
    try {
      if (currentUser) {
        // Load from backend for authenticated users
        const backendSettings = await spellCheckSettingsApi.getSettings();
        if (backendSettings) {
          if (backendSettings.analysis_types) setAnalysisTypes(prev => ({ ...prev, ...backendSettings.analysis_types }));
          if (backendSettings.grammar_rules) setGrammarRules(prev => ({ ...prev, ...backendSettings.grammar_rules }));
          if (backendSettings.style_settings) setStyleSettings(prev => ({ ...prev, ...backendSettings.style_settings }));
          if (backendSettings.code_spell_settings) setCodeSpellSettings(prev => ({ ...prev, ...backendSettings.code_spell_settings }));
          if (backendSettings.selected_style_guide) setSelectedStyleGuide(backendSettings.selected_style_guide);
          if (backendSettings.selected_language) setSelectedLanguage(backendSettings.selected_language);
        }
      } else {
        // For non-logged-in users, load from localStorage
        const storedSettings = localStorage.getItem('spellCheckSettings');
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          if (parsed.analysisTypes) setAnalysisTypes(prev => ({ ...prev, ...parsed.analysisTypes }));
          if (parsed.grammarRules) setGrammarRules(prev => ({ ...prev, ...parsed.grammarRules }));
          if (parsed.styleSettings) setStyleSettings(prev => ({ ...prev, ...parsed.styleSettings }));
          if (parsed.codeSpellSettings) setCodeSpellSettings(prev => ({ ...prev, ...parsed.codeSpellSettings }));
          if (parsed.styleGuide) setSelectedStyleGuide(parsed.styleGuide);
          if (parsed.language) setSelectedLanguage(parsed.language);
        }
      }
    } catch (error) {
      console.error('Failed to load stored settings:', error);
    }
  }, [currentUser]);

  const loadAvailableLanguages = async () => {
    try {
      setLoading(true);
      const languages = await spellCheckApi.getAvailableLanguages();
      // Normalize: API may return objects {code, name, loaded, loading} or plain strings
      const codes = languages.map(l => typeof l === 'string' ? l : l.code);
      setAvailableLanguages(codes.length > 0 ? codes : ['en-US']);
    } catch (error) {
      console.error('Failed to load available languages:', error);
      setAvailableLanguages(['en-US']);
    } finally {
      setLoading(false);
    }
  };

  const loadSupportedCodeLanguages = async () => {
    try {
      const health = await spellCheckApi.checkHealth();
      const langs = health?.service?.components?.cspellCodeChecker?.supportedLanguages;
      if (Array.isArray(langs) && langs.length > 0) {
        setSupportedCodeLanguages(langs);
      } else {
        setSupportedCodeLanguages([
          'javascript', 'typescript', 'python', 'java', 'cpp', 'php',
          'ruby', 'go', 'rust', 'html', 'css', 'sql'
        ]);
      }
    } catch (error) {
      console.error('Failed to load supported code languages:', error);
      setSupportedCodeLanguages(['javascript', 'python']);
    }
  };

  // Load settings and languages when modal opens (single effect, no duplicate)
  useEffect(() => {
    if (show) {
      loadAvailableLanguages();
      loadSupportedCodeLanguages();
      loadStoredSettings();
    }
  }, [show, loadStoredSettings]);

  const saveSettings = useCallback((newSettings) => {
    try {
      if (currentUser) {
        // Debounced save to backend for authenticated users
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          try {
            await spellCheckSettingsApi.saveSettings({
              analysis_types: newSettings.analysisTypes,
              grammar_rules: newSettings.grammarRules,
              style_settings: newSettings.styleSettings,
              code_spell_settings: newSettings.codeSpellSettings,
              selected_language: newSettings.language,
              selected_style_guide: newSettings.styleGuide,
            });
          } catch (err) {
            console.error('Failed to persist settings to backend:', err);
          }
        }, 500);
      } else {
        localStorage.setItem('spellCheckSettings', JSON.stringify(newSettings));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [currentUser]);

  const _buildSettingsPayload = useCallback((overrides = {}) => {
    const merged = {
      analysisTypes: overrides.analysisTypes || analysisTypes,
      grammarRules: overrides.grammarRules || grammarRules,
      styleSettings: overrides.styleSettings || styleSettings,
      codeSpellSettings: overrides.codeSpellSettings || codeSpellSettings,
      styleGuide: overrides.styleGuide ?? selectedStyleGuide,
      language: overrides.language ?? selectedLanguage,
    };
    return merged;
  }, [analysisTypes, grammarRules, styleSettings, codeSpellSettings, selectedStyleGuide, selectedLanguage]);

  const _notifyParent = useCallback((overrides = {}) => {
    const cs = overrides.codeSpellSettings || codeSpellSettings;
    onSettingsChange({
      ...(overrides.analysisTypes || analysisTypes),
      grammarRules: overrides.grammarRules || grammarRules,
      styleSettings: overrides.styleSettings || styleSettings,
      enableCodeSpellCheck: cs.enabled,
      codeSpellSettings: {
        checkComments: cs.checkComments,
        checkStrings: cs.checkStrings,
        checkIdentifiers: cs.checkIdentifiers,
      },
      styleGuide: overrides.styleGuide ?? selectedStyleGuide,
      language: overrides.language ?? selectedLanguage,
    });
  }, [analysisTypes, grammarRules, styleSettings, codeSpellSettings, selectedStyleGuide, selectedLanguage, onSettingsChange]);

  const handleAnalysisTypeToggle = (type) => {
    const newAnalysisTypes = { ...analysisTypes, [type]: !analysisTypes[type] };
    setAnalysisTypes(newAnalysisTypes);
    saveSettings(_buildSettingsPayload({ analysisTypes: newAnalysisTypes }));
    _notifyParent({ analysisTypes: newAnalysisTypes });
  };

  const handleCodeSpellToggle = (setting) => {
    const newCodeSpellSettings = { ...codeSpellSettings, [setting]: !codeSpellSettings[setting] };
    setCodeSpellSettings(newCodeSpellSettings);
    saveSettings(_buildSettingsPayload({ codeSpellSettings: newCodeSpellSettings }));
    _notifyParent({ codeSpellSettings: newCodeSpellSettings });
  };

  const handleStyleGuideChange = (styleGuide) => {
    setSelectedStyleGuide(styleGuide);
    saveSettings(_buildSettingsPayload({ styleGuide }));
    _notifyParent({ styleGuide });
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);
    if (autoDetectLanguage) setAutoDetectLanguage(false);
    saveSettings(_buildSettingsPayload({ language, autoDetectLanguage: false }));
    _notifyParent({ language, autoDetectLanguage: false });
  };

  const handleAutoDetectToggle = () => {
    const newValue = !autoDetectLanguage;
    setAutoDetectLanguage(newValue);
    if (!newValue) setDetectedLanguage(null);
    saveSettings(_buildSettingsPayload({ autoDetectLanguage: newValue }));
    _notifyParent({ autoDetectLanguage: newValue });
  };

  const runLanguageDetection = useCallback(async (text) => {
    if (!autoDetectLanguage || !text || text.length < 20) return;
    try {
      const result = await spellCheckApi.detectLanguage(text);
      if (result?.language) {
        setDetectedLanguage(result);
        if (result.confidence > 0.7 && result.language !== selectedLanguage) {
          setSelectedLanguage(result.language);
          _notifyParent({ language: result.language });
        }
      }
    } catch (error) {
      console.error('Auto-detect language failed:', error);
    }
  }, [autoDetectLanguage, selectedLanguage, _notifyParent]);

  const handleGrammarRuleToggle = (rule) => {
    const newRules = { ...grammarRules, [rule]: !grammarRules[rule] };
    setGrammarRules(newRules);
    saveSettings(_buildSettingsPayload({ grammarRules: newRules }));
    _notifyParent({ grammarRules: newRules });
  };

  const handleGrammarThresholdChange = (key, value) => {
    const newRules = { ...grammarRules, [key]: value };
    setGrammarRules(newRules);
    saveSettings(_buildSettingsPayload({ grammarRules: newRules }));
    _notifyParent({ grammarRules: newRules });
  };

  const handleStyleSettingToggle = (setting) => {
    const newSettings = { ...styleSettings, [setting]: !styleSettings[setting] };
    setStyleSettings(newSettings);
    saveSettings(_buildSettingsPayload({ styleSettings: newSettings }));
    _notifyParent({ styleSettings: newSettings });
  };

  const getLanguageDisplayName = (lang) => {
    const names = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'es-ES': 'Spanish',
      'fr-FR': 'French',
      'de-DE': 'German'
    };
    return names[lang] || lang;
  };

  return {
    analysisTypes,
    grammarRules,
    styleSettings,
    codeSpellSettings,
    selectedStyleGuide,
    selectedLanguage,
    autoDetectLanguage,
    detectedLanguage,
    availableLanguages,
    supportedCodeLanguages,
    loading,
    STYLE_GUIDES,
    handleAnalysisTypeToggle,
    handleCodeSpellToggle,
    handleStyleGuideChange,
    handleLanguageChange,
    handleAutoDetectToggle,
    runLanguageDetection,
    handleGrammarRuleToggle,
    handleGrammarThresholdChange,
    handleStyleSettingToggle,
    getLanguageDisplayName
  };
}
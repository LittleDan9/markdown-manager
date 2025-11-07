import { useState, useEffect } from 'react';
import spellCheckApi from '@/api/spellCheckApi';

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

  // Load available languages when modal opens
  useEffect(() => {
    if (show) {
      loadAvailableLanguages();
      loadSupportedCodeLanguages();
      loadStoredSettings();
    }
  }, [show]);

  // Update settings when props change
  useEffect(() => {
    setAnalysisTypes({
      spelling: settings.spelling ?? true,
      grammar: settings.grammar ?? true,
      style: settings.style ?? true,
      readability: settings.readability ?? true
    });
    setCodeSpellSettings({
      enabled: settings.enableCodeSpellCheck ?? false,
      checkComments: settings.codeSpellSettings?.checkComments ?? true,
      checkStrings: settings.codeSpellSettings?.checkStrings ?? false,
      checkIdentifiers: settings.codeSpellSettings?.checkIdentifiers ?? true
    });
    setSelectedStyleGuide(settings.styleGuide || 'none');
    setSelectedLanguage(settings.language || 'en-US');
  }, [settings]);

  const loadAvailableLanguages = async () => {
    try {
      setLoading(true);
      const languages = await spellCheckApi.getAvailableLanguages();
      setAvailableLanguages(languages.length > 0 ? languages : ['en-US']);
    } catch (error) {
      console.error('Failed to load available languages:', error);
      setAvailableLanguages(['en-US']);
    } finally {
      setLoading(false);
    }
  };

  const loadSupportedCodeLanguages = async () => {
    try {
      // Get supported programming languages from spell check service
      const health = await spellCheckApi.checkHealth();
      if (health?.service?.components?.cspellCodeChecker?.supportedLanguages) {
        // Mock the supported code languages based on common languages
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

  const loadStoredSettings = () => {
    try {
      if (currentUser) {
        // For logged-in users, settings should come from backend user profile
        // This will be implemented when backend user settings are available
        console.log('Loading settings from user profile for user:', currentUser.email);
      } else {
        // For non-logged-in users, load from localStorage
        const storedSettings = localStorage.getItem('spellCheckSettings');
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          setAnalysisTypes(prev => ({ ...prev, ...parsed.analysisTypes }));
          setCodeSpellSettings(prev => ({ ...prev, ...parsed.codeSpellSettings }));
          setSelectedStyleGuide(parsed.styleGuide || 'none');
          setSelectedLanguage(parsed.language || 'en-US');
        }
      }
    } catch (error) {
      console.error('Failed to load stored settings:', error);
    }
  };

  const saveSettings = (newSettings) => {
    try {
      if (currentUser) {
        // For logged-in users, save to backend user profile
        // This will be implemented when backend user settings API is available
        console.log('Saving settings to user profile for user:', currentUser.email, newSettings);
      } else {
        // For non-logged-in users, save to localStorage
        localStorage.setItem('spellCheckSettings', JSON.stringify(newSettings));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleAnalysisTypeToggle = (type) => {
    const newAnalysisTypes = {
      ...analysisTypes,
      [type]: !analysisTypes[type]
    };
    setAnalysisTypes(newAnalysisTypes);

    const newSettings = {
      analysisTypes: newAnalysisTypes,
      codeSpellSettings: codeSpellSettings,
      styleGuide: selectedStyleGuide,
      language: selectedLanguage
    };

    // Save to storage
    saveSettings(newSettings);

    // Notify parent immediately
    onSettingsChange({
      ...newAnalysisTypes,
      enableCodeSpellCheck: codeSpellSettings.enabled,
      codeSpellSettings: {
        checkComments: codeSpellSettings.checkComments,
        checkStrings: codeSpellSettings.checkStrings,
        checkIdentifiers: codeSpellSettings.checkIdentifiers
      },
      styleGuide: selectedStyleGuide,
      language: selectedLanguage
    });
  };

  const handleCodeSpellToggle = (setting) => {
    const newCodeSpellSettings = {
      ...codeSpellSettings,
      [setting]: !codeSpellSettings[setting]
    };
    setCodeSpellSettings(newCodeSpellSettings);

    const newSettings = {
      analysisTypes: analysisTypes,
      codeSpellSettings: newCodeSpellSettings,
      styleGuide: selectedStyleGuide,
      language: selectedLanguage
    };

    // Save to storage
    saveSettings(newSettings);

    // Notify parent immediately
    onSettingsChange({
      ...analysisTypes,
      enableCodeSpellCheck: newCodeSpellSettings.enabled,
      codeSpellSettings: {
        checkComments: newCodeSpellSettings.checkComments,
        checkStrings: newCodeSpellSettings.checkStrings,
        checkIdentifiers: newCodeSpellSettings.checkIdentifiers
      },
      styleGuide: selectedStyleGuide,
      language: selectedLanguage
    });
  };

  const handleStyleGuideChange = (styleGuide) => {
    setSelectedStyleGuide(styleGuide);

    const newSettings = {
      analysisTypes: analysisTypes,
      codeSpellSettings: codeSpellSettings,
      styleGuide: styleGuide,
      language: selectedLanguage
    };

    // Save to storage
    saveSettings(newSettings);

    // Notify parent immediately
    onSettingsChange({
      ...analysisTypes,
      enableCodeSpellCheck: codeSpellSettings.enabled,
      codeSpellSettings: {
        checkComments: codeSpellSettings.checkComments,
        checkStrings: codeSpellSettings.checkStrings,
        checkIdentifiers: codeSpellSettings.checkIdentifiers
      },
      styleGuide: styleGuide,
      language: selectedLanguage
    });
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);

    const newSettings = {
      analysisTypes: analysisTypes,
      codeSpellSettings: codeSpellSettings,
      styleGuide: selectedStyleGuide,
      language: language
    };

    // Save to storage
    saveSettings(newSettings);

    // Notify parent immediately
    onSettingsChange({
      ...analysisTypes,
      enableCodeSpellCheck: codeSpellSettings.enabled,
      codeSpellSettings: {
        checkComments: codeSpellSettings.checkComments,
        checkStrings: codeSpellSettings.checkStrings,
        checkIdentifiers: codeSpellSettings.checkIdentifiers
      },
      styleGuide: selectedStyleGuide,
      language: language
    });
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
    codeSpellSettings,
    selectedStyleGuide,
    selectedLanguage,
    availableLanguages,
    supportedCodeLanguages,
    loading,
    STYLE_GUIDES,
    handleAnalysisTypeToggle,
    handleCodeSpellToggle,
    handleStyleGuideChange,
    handleLanguageChange,
    getLanguageDisplayName
  };
}
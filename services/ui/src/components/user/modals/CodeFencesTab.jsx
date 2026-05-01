import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import { useAuth } from '../../../providers/AuthProvider';
import { useTheme } from '../../../providers/ThemeProvider';
import HighlightingApi from '../../../api/highlightingApi';

// Sample code snippet for live preview (covers keywords, strings, functions, comments, numbers)
const SAMPLE_CODE = `<span class="token comment">// Calculate fibonacci sequence</span>
<span class="token keyword">function</span> <span class="token function">fibonacci</span><span class="token punctuation">(</span><span class="token variable">n</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
  <span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token variable">n</span> <span class="token operator">&lt;=</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token keyword">return</span> <span class="token variable">n</span><span class="token punctuation">;</span>
  <span class="token keyword">const</span> <span class="token variable">result</span> <span class="token operator">=</span> <span class="token function">fibonacci</span><span class="token punctuation">(</span><span class="token variable">n</span> <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">)</span> <span class="token operator">+</span> <span class="token function">fibonacci</span><span class="token punctuation">(</span><span class="token variable">n</span> <span class="token operator">-</span> <span class="token number">2</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token keyword">return</span> <span class="token variable">result</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
<span class="token keyword">const</span> <span class="token variable">message</span> <span class="token operator">=</span> <span class="token string">"Hello, world!"</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token variable">message</span><span class="token punctuation">,</span> <span class="token function">fibonacci</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>`;

function CodeFencesTab() {
  const { syntaxTheme, setSyntaxTheme, syntaxOverridesEnabled, setSyntaxOverridesEnabled } = useAuth();
  const { loadSyntaxThemeCSS } = useTheme();
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewCSS, setPreviewCSS] = useState('');
  const previewCSSCache = useRef({});

  // Load available styles from the API
  useEffect(() => {
    let cancelled = false;
    async function fetchStyles() {
      setLoading(true);
      const result = await HighlightingApi.getAvailableStyles();
      if (!cancelled) {
        setStyles(result);
        setLoading(false);
      }
    }
    fetchStyles();
    return () => { cancelled = true; };
  }, []);

  // Load preview CSS when selected theme changes
  const loadPreviewCSS = useCallback(async (styleName) => {
    if (previewCSSCache.current[styleName]) {
      setPreviewCSS(previewCSSCache.current[styleName]);
      return;
    }
    const css = await HighlightingApi.getStyleCSS(styleName);
    if (css) {
      previewCSSCache.current[styleName] = css;
      setPreviewCSS(css);
    }
  }, []);

  useEffect(() => {
    if (syntaxTheme) {
      loadPreviewCSS(syntaxTheme);
    }
  }, [syntaxTheme, loadPreviewCSS]);

  const handleThemeChange = async (e) => {
    const newTheme = e.target.value;
    setSyntaxTheme(newTheme);
    loadSyntaxThemeCSS(newTheme);
  };

  const handleOverridesToggle = (e) => {
    setSyntaxOverridesEnabled(e.target.checked);
  };

  // Group styles by variant for display
  const darkStyles = styles.filter(s => s.variant === 'dark');
  const lightStyles = styles.filter(s => s.variant === 'light');

  return (
    <div className="pt-3">
      <h6 className="mb-3">Code Fence Appearance</h6>
      <p className="text-muted small mb-3">
        Choose a syntax highlighting theme for code blocks in the preview and exported documents.
      </p>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold small">Syntax Theme</Form.Label>
        {loading ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span className="text-muted small">Loading themes...</span>
          </div>
        ) : (
          <Form.Select
            size="sm"
            value={syntaxTheme}
            onChange={handleThemeChange}
            style={{ maxWidth: '280px' }}
          >
            <optgroup label="Dark Themes">
              {darkStyles.map(s => (
                <option key={s.name} value={s.name}>
                  {s.label}{s.companion ? '' : ' (pairs best with dark)'}
                </option>
              ))}
            </optgroup>
            <optgroup label="Light Themes">
              {lightStyles.map(s => (
                <option key={s.name} value={s.name}>
                  {s.label}{s.companion ? '' : ' (pairs best with light)'}
                </option>
              ))}
            </optgroup>
          </Form.Select>
        )}
      </Form.Group>

      <Form.Group className="mb-4">
        <Form.Check
          type="switch"
          id="syntax-overrides-switch"
          label="Use Markdown Manager Overrides"
          checked={syntaxOverridesEnabled}
          onChange={handleOverridesToggle}
        />
        <Form.Text className="text-muted">
          Applies custom refinements (font weights, italics, language-specific colors) on top of the selected theme.
        </Form.Text>
      </Form.Group>

      {/* Live Preview */}
      <div className="mb-2">
        <Form.Label className="fw-semibold small">Preview</Form.Label>
      </div>
      <div
        className={`code-fence-preview border rounded ${syntaxOverridesEnabled ? '' : 'no-syntax-overrides'}`}
        style={{ overflow: 'hidden' }}
      >
        {/* Scoped style for the preview container */}
        <style>{previewCSS}</style>
        <div className="code-block">
          <div className="code-block-header">
            <span className="code-block-lang">JAVASCRIPT</span>
          </div>
          <pre className="language-javascript" style={{ margin: 0, padding: '1rem', fontSize: '0.8rem' }}>
            <code dangerouslySetInnerHTML={{ __html: SAMPLE_CODE }} />
          </pre>
        </div>
      </div>
    </div>
  );
}

export default CodeFencesTab;

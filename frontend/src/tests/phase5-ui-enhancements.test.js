/**
 * Integration Tests for Phase 5 Advanced UI Enhancements
 * Tests spell check settings panel, readability display, and advanced features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpellCheckSettingsPanel } from '../src/components/editor/spell-check/SpellCheckSettingsPanel';
import { ReadabilityMetricsDisplay } from '../src/components/editor/spell-check/ReadabilityMetricsDisplay';
import { SpellCheckGroup } from '../src/components/editor/markdown-toolbar/SpellCheckGroup';

// Mock the API module
jest.mock('../src/api/spellCheckApi', () => ({
  getAvailableLanguages: jest.fn().mockResolvedValue(['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE']),
  checkText: jest.fn().mockResolvedValue({
    results: {
      spelling: [
        {
          word: 'mispelled',
          suggestions: ['misspelled', 'dispelled'],
          position: { start: 10, end: 19 },
          type: 'spelling'
        }
      ],
      grammar: [
        {
          word: 'the the',
          suggestions: ['Remove duplicate'],
          position: { start: 25, end: 32 },
          type: 'grammar'
        }
      ],
      style: [
        {
          word: 'very',
          suggestions: ['Revise for clarity'],
          position: { start: 40, end: 44 },
          type: 'style'
        }
      ]
    },
    analysis: {
      readability: {
        fleschKincaid: 8.2,
        fleschReadingEase: 72.5,
        gunningFog: 9.1,
        smog: 8.7,
        wordCount: 150,
        sentenceCount: 8,
        paragraphCount: 3,
        averageWordsPerSentence: 18.75,
        averageSyllablesPerWord: 1.4
      }
    }
  })
}));

describe('Phase 5 Advanced UI Enhancements', () => {
  
  describe('SpellCheckSettingsPanel', () => {
    const defaultSettings = {
      spelling: true,
      grammar: true,
      style: true,
      readability: true,
      styleGuide: 'none',
      language: 'en-US'
    };

    const mockOnSettingsChange = jest.fn();

    beforeEach(() => {
      mockOnSettingsChange.mockClear();
    });

    test('renders settings panel with all analysis type toggles', () => {
      render(
        <SpellCheckSettingsPanel
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      expect(screen.getByLabelText(/Spelling/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Grammar/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Style/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Readability/)).toBeInTheDocument();
    });

    test('analysis type toggles are checked according to settings', () => {
      render(
        <SpellCheckSettingsPanel
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      expect(screen.getByLabelText(/Spelling/)).toBeChecked();
      expect(screen.getByLabelText(/Grammar/)).toBeChecked();
      expect(screen.getByLabelText(/Style/)).toBeChecked();
      expect(screen.getByLabelText(/Readability/)).toBeChecked();
    });

    test('style guide buttons are rendered with correct selection', () => {
      render(
        <SpellCheckSettingsPanel
          settings={{ ...defaultSettings, styleGuide: 'ap' }}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      // Check that style guide buttons exist
      expect(screen.getByText('None')).toBeInTheDocument();
      expect(screen.getByText('AP Style')).toBeInTheDocument();
      expect(screen.getByText('Chicago Manual')).toBeInTheDocument();
      expect(screen.getByText('MLA')).toBeInTheDocument();
      expect(screen.getByText('APA')).toBeInTheDocument();
    });

    test('toggling analysis types calls onSettingsChange', () => {
      render(
        <SpellCheckSettingsPanel
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      // Toggle spelling off
      fireEvent.click(screen.getByLabelText(/Spelling/));

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        spelling: false
      });
    });

    test('changing style guide calls onSettingsChange', () => {
      render(
        <SpellCheckSettingsPanel
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      // Select AP style guide
      fireEvent.click(screen.getByText('AP Style'));

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        styleGuide: 'ap'
      });
    });

    test('advanced settings section expands and shows language selection', async () => {
      render(
        <SpellCheckSettingsPanel
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      // Click advanced settings
      fireEvent.click(screen.getByText(/Advanced Settings/));

      await waitFor(() => {
        expect(screen.getByLabelText(/Language/)).toBeInTheDocument();
      });
    });
  });

  describe('ReadabilityMetricsDisplay', () => {
    const mockReadabilityData = {
      fleschKincaid: 8.2,
      fleschReadingEase: 72.5,
      gunningFog: 9.1,
      smog: 8.7,
      wordCount: 150,
      sentenceCount: 8,
      paragraphCount: 3,
      averageWordsPerSentence: 18.75,
      averageSyllablesPerWord: 1.4
    };

    test('renders readability metrics when visible', () => {
      render(
        <ReadabilityMetricsDisplay
          readabilityData={mockReadabilityData}
          isVisible={true}
        />
      );

      expect(screen.getByText('Readability Analysis')).toBeInTheDocument();
      expect(screen.getByText('Grade 8.2')).toBeInTheDocument();
      expect(screen.getByText('73')).toBeInTheDocument(); // Flesch Reading Ease score
    });

    test('shows correct reading level interpretation', () => {
      render(
        <ReadabilityMetricsDisplay
          readabilityData={mockReadabilityData}
          isVisible={true}
        />
      );

      // For score of 72.5, should be "Fairly Easy"
      expect(screen.getByText('Fairly Easy')).toBeInTheDocument();
    });

    test('displays document statistics correctly', () => {
      render(
        <ReadabilityMetricsDisplay
          readabilityData={mockReadabilityData}
          isVisible={true}
        />
      );

      expect(screen.getByText('150')).toBeInTheDocument(); // Word count
      expect(screen.getByText('8')).toBeInTheDocument(); // Sentence count
      expect(screen.getByText('3')).toBeInTheDocument(); // Paragraph count
    });

    test('does not render when not visible', () => {
      render(
        <ReadabilityMetricsDisplay
          readabilityData={mockReadabilityData}
          isVisible={false}
        />
      );

      expect(screen.queryByText('Readability Analysis')).not.toBeInTheDocument();
    });

    test('does not render when no data provided', () => {
      render(
        <ReadabilityMetricsDisplay
          readabilityData={null}
          isVisible={true}
        />
      );

      expect(screen.queryByText('Readability Analysis')).not.toBeInTheDocument();
    });
  });

  describe('SpellCheckGroup Integration', () => {
    const mockOnSpellCheck = jest.fn();
    const mockOnMarkdownLint = jest.fn();
    const mockOnSpellCheckSettings = jest.fn();

    const defaultProps = {
      onSpellCheck: mockOnSpellCheck,
      onMarkdownLint: mockOnMarkdownLint,
      onSpellCheckSettings: mockOnSpellCheckSettings,
      buttonVariant: 'outline-secondary',
      buttonStyle: {},
      spellCheckProgress: null,
      markdownLintProgress: null,
      spellCheckSettings: {
        spelling: true,
        grammar: true,
        style: true,
        readability: true,
        styleGuide: 'none',
        language: 'en-US'
      },
      readabilityData: null,
      serviceInfo: null
    };

    beforeEach(() => {
      mockOnSpellCheck.mockClear();
      mockOnMarkdownLint.mockClear();
      mockOnSpellCheckSettings.mockClear();
    });

    test('renders spell check button with settings dropdown', () => {
      render(<SpellCheckGroup {...defaultProps} />);

      expect(screen.getByTitle(/Run Spell Check/)).toBeInTheDocument();
      expect(screen.getByTitle(/Spell Check Settings/)).toBeInTheDocument();
    });

    test('spell check button calls onSpellCheck with settings', () => {
      render(<SpellCheckGroup {...defaultProps} />);

      fireEvent.click(screen.getByTitle(/Run Spell Check/));

      expect(mockOnSpellCheck).toHaveBeenCalledWith(defaultProps.spellCheckSettings);
    });

    test('settings dropdown shows analysis type toggles', () => {
      render(<SpellCheckGroup {...defaultProps} />);

      // Open dropdown
      fireEvent.click(screen.getByTitle(/Spell Check Settings/));

      expect(screen.getByText(/Spelling/)).toBeInTheDocument();
      expect(screen.getByText(/Grammar/)).toBeInTheDocument();
      expect(screen.getByText(/Style/)).toBeInTheDocument();
    });

    test('quick toggle in dropdown calls onSpellCheckSettings', () => {
      render(<SpellCheckGroup {...defaultProps} />);

      // Open dropdown
      fireEvent.click(screen.getByTitle(/Spell Check Settings/));

      // Click spelling toggle
      const spellingToggle = screen.getByText(/Spelling/);
      fireEvent.click(spellingToggle);

      expect(mockOnSpellCheckSettings).toHaveBeenCalledWith({
        ...defaultProps.spellCheckSettings,
        spelling: false
      });
    });

    test('advanced settings option shows settings panel', () => {
      render(<SpellCheckGroup {...defaultProps} />);

      // Open dropdown
      fireEvent.click(screen.getByTitle(/Spell Check Settings/));

      // Click advanced settings
      fireEvent.click(screen.getByText(/Advanced Settings.../));

      expect(screen.getByText('Analysis Settings')).toBeInTheDocument();
    });

    test('settings panel can be hidden via close button', () => {
      render(<SpellCheckGroup {...defaultProps} />);

      // Open dropdown and show advanced settings
      fireEvent.click(screen.getByTitle(/Spell Check Settings/));
      fireEvent.click(screen.getByText(/Advanced Settings.../));

      expect(screen.getByText('Analysis Settings')).toBeInTheDocument();

      // Close the panel
      const closeButton = screen.getByRole('button').closest('.card-header').querySelector('button');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Analysis Settings')).not.toBeInTheDocument();
    });
  });

  describe('End-to-End Integration', () => {
    test('changing settings affects analysis results', async () => {
      // This test would require mocking the full editor environment
      // For now, we'll test that the settings flow works correctly
      
      const mockOnSettingsChange = jest.fn();
      
      render(
        <SpellCheckSettingsPanel
          settings={{
            spelling: true,
            grammar: false,
            style: true,
            readability: true,
            styleGuide: 'ap',
            language: 'en-US'
          }}
          onSettingsChange={mockOnSettingsChange}
          isVisible={true}
        />
      );

      // Enable grammar
      fireEvent.click(screen.getByLabelText(/Grammar/));

      expect(mockOnSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          grammar: true
        })
      );
    });
  });
});

describe('Performance and Accessibility', () => {
  test('settings panel has proper ARIA labels', () => {
    render(
      <SpellCheckSettingsPanel
        settings={{
          spelling: true,
          grammar: true,
          style: true,
          readability: true,
          styleGuide: 'none',
          language: 'en-US'
        }}
        onSettingsChange={() => {}}
        isVisible={true}
      />
    );

    // Check for proper form controls
    expect(screen.getByRole('switch', { name: /Spelling/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Grammar/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Style/ })).toBeInTheDocument();
  });

  test('readability display handles large numbers correctly', () => {
    const largeData = {
      fleschKincaid: 15.7,
      fleschReadingEase: 25.3,
      wordCount: 50000,
      sentenceCount: 2500,
      paragraphCount: 500
    };

    render(
      <ReadabilityMetricsDisplay
        readabilityData={largeData}
        isVisible={true}
      />
    );

    // Check that large numbers are formatted with commas
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });
});
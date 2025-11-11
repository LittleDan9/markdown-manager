/**
 * Readability Metrics Display Component
 * Phase 5: Advanced UI Enhancements
 * 
 * Shows readability analysis including:
 * - Flesch-Kincaid Grade Level
 * - Flesch Reading Ease Score
 * - Gunning Fog Index
 * - SMOG Index
 * - Document statistics
 */

import React from 'react';
import { Card, Row, Col, Badge, ProgressBar } from 'react-bootstrap';

const READABILITY_SCALES = {
  fleschReadingEase: [
    { min: 90, max: 100, level: 'Very Easy', color: 'success', description: '5th grade' },
    { min: 80, max: 89, level: 'Easy', color: 'success', description: '6th grade' },
    { min: 70, max: 79, level: 'Fairly Easy', color: 'info', description: '7th grade' },
    { min: 60, max: 69, level: 'Standard', color: 'primary', description: '8th & 9th grade' },
    { min: 50, max: 59, level: 'Fairly Difficult', color: 'warning', description: '10th to 12th grade' },
    { min: 30, max: 49, level: 'Difficult', color: 'warning', description: 'College level' },
    { min: 0, max: 29, level: 'Very Difficult', color: 'danger', description: 'Graduate level' }
  ]
};

export function ReadabilityMetricsDisplay({ 
  readabilityData, 
  isVisible = false,
  className = ""
}) {
  if (!isVisible || !readabilityData) {
    return null;
  }

  const getReadabilityScale = (score, type = 'fleschReadingEase') => {
    const scale = READABILITY_SCALES[type];
    if (!scale || score === null || score === undefined) return null;
    
    return scale.find(item => score >= item.min && score <= item.max);
  };

  const formatMetricValue = (value, type) => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (type) {
      case 'grade':
        return `Grade ${Math.round(value * 10) / 10}`;
      case 'score':
        return Math.round(value);
      case 'decimal':
        return Math.round(value * 100) / 100;
      case 'percentage':
        return `${Math.round(value)}%`;
      default:
        return Math.round(value);
    }
  };

  const readingEaseScale = getReadabilityScale(readabilityData.fleschReadingEase);
  const gradeLevel = readabilityData.fleschKincaid || readabilityData.gradeLevel;

  return (
    <Card className={`readability-metrics ${className}`}>
      <Card.Header>
        <div className="d-flex align-items-center">
          <i className="bi bi-bar-chart me-2"></i>
          <strong>Readability Analysis</strong>
        </div>
      </Card.Header>
      
      <Card.Body>
        {/* Overall Reading Level */}
        {readingEaseScale && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold">Reading Level</span>
              <Badge bg={readingEaseScale.color} className="px-3">
                {readingEaseScale.level}
              </Badge>
            </div>
            
            <ProgressBar 
              now={readabilityData.fleschReadingEase} 
              variant={readingEaseScale.color}
              className="mb-2"
              style={{ height: '8px' }}
            />
            
            <div className="d-flex justify-content-between text-muted small">
              <span>Score: {formatMetricValue(readabilityData.fleschReadingEase, 'score')}</span>
              <span>{readingEaseScale.description}</span>
            </div>
          </div>
        )}

        {/* Grade Level Summary */}
        {gradeLevel && (
          <div className="mb-4 text-center">
            <div className="display-6 fw-bold text-primary">
              {formatMetricValue(gradeLevel, 'grade')}
            </div>
            <small className="text-muted">Recommended Education Level</small>
          </div>
        )}

        {/* Detailed Metrics */}
        <Row>
          {/* Readability Scores */}
          <Col md={6}>
            <h6 className="mb-3 text-muted">Readability Scores</h6>
            
            {readabilityData.fleschKincaid && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Flesch-Kincaid Grade:</span>
                <Badge bg="light" text="dark">
                  {formatMetricValue(readabilityData.fleschKincaid, 'grade')}
                </Badge>
              </div>
            )}
            
            {readabilityData.fleschReadingEase && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Flesch Reading Ease:</span>
                <Badge bg="light" text="dark">
                  {formatMetricValue(readabilityData.fleschReadingEase, 'score')}
                </Badge>
              </div>
            )}
            
            {readabilityData.gunningFog && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Gunning Fog Index:</span>
                <Badge bg="light" text="dark">
                  {formatMetricValue(readabilityData.gunningFog, 'grade')}
                </Badge>
              </div>
            )}
            
            {readabilityData.smog && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">SMOG Index:</span>
                <Badge bg="light" text="dark">
                  {formatMetricValue(readabilityData.smog, 'grade')}
                </Badge>
              </div>
            )}
          </Col>

          {/* Document Statistics */}
          <Col md={6}>
            <h6 className="mb-3 text-muted">Document Statistics</h6>
            
            {readabilityData.wordCount && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Words:</span>
                <Badge bg="secondary">
                  {readabilityData.wordCount.toLocaleString()}
                </Badge>
              </div>
            )}
            
            {readabilityData.sentenceCount && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Sentences:</span>
                <Badge bg="secondary">
                  {readabilityData.sentenceCount.toLocaleString()}
                </Badge>
              </div>
            )}
            
            {readabilityData.paragraphCount && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Paragraphs:</span>
                <Badge bg="secondary">
                  {readabilityData.paragraphCount.toLocaleString()}
                </Badge>
              </div>
            )}
            
            {readabilityData.averageWordsPerSentence && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Avg Words/Sentence:</span>
                <Badge bg="light" text="dark">
                  {formatMetricValue(readabilityData.averageWordsPerSentence, 'decimal')}
                </Badge>
              </div>
            )}
            
            {readabilityData.averageSyllablesPerWord && (
              <div className="d-flex justify-content-between mb-2">
                <span className="small">Avg Syllables/Word:</span>
                <Badge bg="light" text="dark">
                  {formatMetricValue(readabilityData.averageSyllablesPerWord, 'decimal')}
                </Badge>
              </div>
            )}
          </Col>
        </Row>

        {/* Reading Level Interpretation */}
        {readingEaseScale && (
          <div className="mt-4 p-3 bg-light rounded">
            <div className="small">
              <strong>Interpretation:</strong> This text is rated as <strong>{readingEaseScale.level.toLowerCase()}</strong> to read, 
              appropriate for readers at the <strong>{readingEaseScale.description}</strong> level.
              {gradeLevel && gradeLevel > 16 && (
                <span className="text-warning"> This content may be challenging for general audiences.</span>
              )}
              {gradeLevel && gradeLevel < 6 && (
                <span className="text-info"> This content is very accessible to most readers.</span>
              )}
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default ReadabilityMetricsDisplay;
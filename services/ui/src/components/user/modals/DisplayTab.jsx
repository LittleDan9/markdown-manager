import React from 'react';
import { Form } from 'react-bootstrap';
import { useAuth } from '../../../providers/AuthProvider';

/**
 * DisplayTab - User display preferences for tab bar position and sort order.
 */
function DisplayTab() {
  const { tabPosition, setTabPosition, tabSortOrder, setTabSortOrder, recentsTabLimit, setRecentsTabLimit, searchMode, setSearchMode } = useAuth();

  return (
    <div className="pt-3">
      <h6 className="mb-3">Document Tabs</h6>
      <p className="text-muted small mb-3">
        Documents in the same category are shown as switchable tabs.
      </p>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold small">Tab Bar Position</Form.Label>
        <div>
          <Form.Check
            inline
            type="radio"
            id="tab-pos-above"
            label="Above preview"
            name="tabPosition"
            checked={tabPosition === 'above'}
            onChange={() => setTabPosition('above')}
          />
          <Form.Check
            inline
            type="radio"
            id="tab-pos-below"
            label="Below preview"
            name="tabPosition"
            checked={tabPosition === 'below'}
            onChange={() => setTabPosition('below')}
          />
        </div>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold small">Tab Sort Order</Form.Label>
        <Form.Select
          size="sm"
          value={tabSortOrder}
          onChange={e => setTabSortOrder(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="opened_desc">Recent → Old</option>
          <option value="opened_asc">Old → Recent</option>
          <option value="alpha_asc">A → Z</option>
          <option value="alpha_desc">Z → A</option>
        </Form.Select>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold small">Recent Documents Limit</Form.Label>
        <Form.Control
          type="number"
          size="sm"
          min={1}
          max={25}
          value={recentsTabLimit}
          onChange={e => setRecentsTabLimit(e.target.value)}
          style={{ maxWidth: '100px' }}
        />
        <Form.Text className="text-muted">
          Number of tabs shown when opening Recent (1–25)
        </Form.Text>
      </Form.Group>

      <hr className="my-4" />

      <h6 className="mb-3">Search</h6>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold small">Default Search Mode</Form.Label>
        <Form.Select
          size="sm"
          value={searchMode}
          onChange={e => setSearchMode(e.target.value)}
          style={{ maxWidth: '250px' }}
        >
          <option value="quick">Quick — fast keyword + semantic hybrid</option>
          <option value="deep">Deep — LLM-expanded multi-query (slower, better recall)</option>
        </Form.Select>
        <Form.Text className="text-muted">
          Deep search uses AI to rephrase your query for better results
        </Form.Text>
      </Form.Group>
    </div>
  );
}

export default DisplayTab;

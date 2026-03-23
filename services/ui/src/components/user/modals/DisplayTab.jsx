import React from 'react';
import { Form } from 'react-bootstrap';
import { useAuth } from '../../../providers/AuthProvider';

/**
 * DisplayTab - User display preferences for tab bar position and sort order.
 */
function DisplayTab() {
  const { tabPosition, setTabPosition, tabSortOrder, setTabSortOrder } = useAuth();

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
          <option value="name">Name</option>
          <option value="created">Created date</option>
          <option value="modified">Last modified</option>
        </Form.Select>
      </Form.Group>
    </div>
  );
}

export default DisplayTab;

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * OutlinePanel - Collapsible sidebar panel showing document heading hierarchy.
 * Click a heading to scroll the editor to that line.
 */
function OutlinePanel({ headingTree, activeHeadingLine, onHeadingClick, visible }) {
  if (!visible) return null;

  return (
    <div className="outline-panel">
      <div className="outline-panel__header">
        <i className="bi bi-list-nested" />
        <span>Outline</span>
      </div>
      <div className="outline-panel__content">
        {headingTree.length === 0 ? (
          <div className="outline-panel__empty">
            <small className="text-muted">No headings found</small>
          </div>
        ) : (
          <OutlineTree
            nodes={headingTree}
            activeHeadingLine={activeHeadingLine}
            onHeadingClick={onHeadingClick}
          />
        )}
      </div>
    </div>
  );
}

OutlinePanel.propTypes = {
  headingTree: PropTypes.array.isRequired,
  activeHeadingLine: PropTypes.number,
  onHeadingClick: PropTypes.func.isRequired,
  visible: PropTypes.bool.isRequired,
};

/**
 * Recursive tree renderer for heading hierarchy.
 */
function OutlineTree({ nodes, activeHeadingLine, onHeadingClick }) {
  return (
    <ul className="outline-tree">
      {nodes.map((node) => (
        <OutlineNode
          key={`${node.line}-${node.text}`}
          node={node}
          activeHeadingLine={activeHeadingLine}
          onHeadingClick={onHeadingClick}
        />
      ))}
    </ul>
  );
}

OutlineTree.propTypes = {
  nodes: PropTypes.array.isRequired,
  activeHeadingLine: PropTypes.number,
  onHeadingClick: PropTypes.func.isRequired,
};

/**
 * Individual outline node with children.
 */
function OutlineNode({ node, activeHeadingLine, onHeadingClick }) {
  const isActive = activeHeadingLine === node.line;

  const handleClick = useCallback((e) => {
    e.preventDefault();
    onHeadingClick(node.line);
  }, [node.line, onHeadingClick]);

  return (
    <li className="outline-node">
      <button
        className={`outline-node__label ${isActive ? 'outline-node__label--active' : ''}`}
        onClick={handleClick}
        title={`Line ${node.line}: ${node.text}`}
      >
        <span className="outline-node__text">{node.text}</span>
      </button>
      {node.children && node.children.length > 0 && (
        <OutlineTree
          nodes={node.children}
          activeHeadingLine={activeHeadingLine}
          onHeadingClick={onHeadingClick}
        />
      )}
    </li>
  );
}

OutlineNode.propTypes = {
  node: PropTypes.shape({
    level: PropTypes.number.isRequired,
    text: PropTypes.string.isRequired,
    line: PropTypes.number.isRequired,
    children: PropTypes.array,
  }).isRequired,
  activeHeadingLine: PropTypes.number,
  onHeadingClick: PropTypes.func.isRequired,
};

export default OutlinePanel;

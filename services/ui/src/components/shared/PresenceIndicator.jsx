import React from 'react';
import PropTypes from 'prop-types';

/**
 * PresenceIndicator — Shows avatars of users currently viewing the same document.
 */
function PresenceIndicator({ users, maxVisible = 3 }) {
  if (!users || users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="presence-indicator d-flex align-items-center gap-1" title={users.map(u => u.display_name).join(', ')}>
      {visible.map((user) => (
        <span
          key={user.user_id}
          className="presence-avatar badge rounded-pill bg-primary-subtle text-primary"
          title={user.display_name}
        >
          {getInitials(user.display_name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="presence-avatar badge rounded-pill bg-secondary-subtle text-secondary">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

PresenceIndicator.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    user_id: PropTypes.number.isRequired,
    display_name: PropTypes.string.isRequired,
  })),
  maxVisible: PropTypes.number,
};

export default PresenceIndicator;

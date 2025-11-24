import React from 'react';
import { GitHubCachePanel } from '../index';

export default function GitHubCacheSyncTab({ isActive = false }) {
  return (
    <div className="github-cache-sync-tab">
      <GitHubCachePanel isActive={isActive} />
    </div>
  );
}

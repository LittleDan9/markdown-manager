import { useState, useEffect } from 'react';

const globalFileModalState = {
  showFileModal: false,
  activeTab: 'local',
  selectedRepository: null,
  returnCallback: null,
  listeners: []
};

const useFileModal = () => {
  const [, forceUpdate] = useState({});

  const openFileModal = (tab = 'local', repository = null, returnCallback = null) => {
    globalFileModalState.showFileModal = true;
    globalFileModalState.activeTab = tab;
    globalFileModalState.selectedRepository = repository;
    globalFileModalState.returnCallback = returnCallback;
    globalFileModalState.listeners.forEach(listener => listener());
  };

  const closeFileModal = () => {
    const callback = globalFileModalState.returnCallback;
    globalFileModalState.showFileModal = false;
    globalFileModalState.selectedRepository = null;
    globalFileModalState.returnCallback = null;
    globalFileModalState.listeners.forEach(listener => listener());
    
    // Execute return callback if provided
    if (callback) {
      callback();
    }
  };

  const openGitHubTab = (repository = null, returnCallback = null) => {
    openFileModal('github', repository, returnCallback);
  };

  // Subscribe to state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalFileModalState.listeners.push(listener);

    return () => {
      const index = globalFileModalState.listeners.indexOf(listener);
      if (index > -1) {
        globalFileModalState.listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    showFileModal: globalFileModalState.showFileModal,
    activeTab: globalFileModalState.activeTab,
    selectedRepository: globalFileModalState.selectedRepository,
    returnCallback: globalFileModalState.returnCallback,
    openFileModal,
    closeFileModal,
    openGitHubTab
  };
};

export default useFileModal;

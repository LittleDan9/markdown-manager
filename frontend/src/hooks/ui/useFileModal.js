import { useState, useEffect } from 'react';

let globalFileModalState = {
  showFileModal: false,
  activeTab: 'local',
  selectedRepository: null,
  listeners: []
};

const useFileModal = () => {
  const [, forceUpdate] = useState({});

  const openFileModal = (tab = 'local', repository = null) => {
    globalFileModalState.showFileModal = true;
    globalFileModalState.activeTab = tab;
    globalFileModalState.selectedRepository = repository;
    globalFileModalState.listeners.forEach(listener => listener());
  };

  const closeFileModal = () => {
    globalFileModalState.showFileModal = false;
    globalFileModalState.selectedRepository = null;
    globalFileModalState.listeners.forEach(listener => listener());
  };

  const openGitHubTab = (repository = null) => {
    openFileModal('github', repository);
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
    openFileModal,
    closeFileModal,
    openGitHubTab
  };
};

export default useFileModal;

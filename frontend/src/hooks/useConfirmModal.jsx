import { useState } from "react";

export function useConfirmModal(defaultConfig = {}) {
  const [show, setShow] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [modalConfig, setModalConfig] = useState(defaultConfig);

  // actionHandler receives the action key (e.g. "save", "confirm", "cancel")
  const openModal = (actionHandler, config = {}) => {
    setPendingAction(() => actionHandler);
    setModalConfig({ ...defaultConfig, ...config });
    setShow(true);
  };

  const handleAction = async (actionKey) => {
    if (pendingAction) await pendingAction(actionKey);
    setShow(false);
    setPendingAction(null);
  };

  return {
    show,
    modalConfig,
    openModal,
    handleAction,
  };
}

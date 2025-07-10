import { useState } from "react";

export function useConfirmModal(defaultConfig = {}) {
  const [show, setShow] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [modalConfig, setModalConfig] = useState(defaultConfig);

  const openModal = (action, config = {}) => {
    setPendingAction(() => action);
    setModalConfig({ ...defaultConfig, ...config });
    setShow(true);
  };

  const handleConfirm = async () => {
    if (pendingAction) await pendingAction();
    setShow(false);
    setPendingAction(null);
  };

  const handleCancel = () => {
    setShow(false);
    setPendingAction(null);
  };

  return {
    show,
    modalConfig,
    openModal,
    handleConfirm,
    handleCancel,
  };
}

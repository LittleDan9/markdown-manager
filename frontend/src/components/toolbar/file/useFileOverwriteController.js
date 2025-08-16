import { useState, useCallback } from "react";

export function useFileOverwriteController({ importController }) {
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);

  const openOverwriteModal = useCallback((importData) => {
    setPendingImport(importData);
    setShowOverwriteModal(true);
  }, []);

  const handleOverwriteConfirm = useCallback(async () => {
    if (importController && importController.handleOverwriteConfirm) {
      await importController.handleOverwriteConfirm();
    }
    setShowOverwriteModal(false);
    setPendingImport(null);
  }, [importController]);

  const handleOverwriteCancel = useCallback(() => {
    if (importController && importController.handleOverwriteCancel) {
      importController.handleOverwriteCancel();
    }
    setShowOverwriteModal(false);
    setPendingImport(null);
  }, [importController]);

  return {
    showOverwriteModal,
    setShowOverwriteModal,
    pendingImport,
    setPendingImport,
    openOverwriteModal,
    handleOverwriteConfirm,
    handleOverwriteCancel,
  };
}

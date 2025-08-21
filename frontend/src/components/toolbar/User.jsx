import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNotification } from "@/components/NotificationProvider";
import UserMenuLoggedIn from "@/components/toolbar/UserMenuLoggedIn";
import UserMenuLoggedOut from "@/components/toolbar/UserMenuLoggedOut";
import { useAuth } from "@/providers/AuthProvider";
import { useDocumentContext } from "@/providers/DocumentContextProvider.jsx";


function UserToolbar({ handleThemeToggle, theme }) {
  const { showSuccess, showError } = useNotification();
  const { user, setUser } = useAuth();
  const { isSharedView } = useDocumentContext();

  return (
    <>
    <Dropdown align="end" id="userDropdown">
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        className="d-flex align-items-center gap-2"
        id="userMenuDropdown"
      >
        <i className="bi bi-person-circle"></i>
        <span id="userDisplayName">{user.display_name}</span>
      </Dropdown.Toggle>
      {user.is_active ? (
        <UserMenuLoggedIn />
      ) : (
        <UserMenuLoggedOut isSharedView={isSharedView} />
      )}
    </Dropdown>
    </>
  );
}

export default UserToolbar;

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

  // Admin styling
  const adminClass = user.is_admin ? "text-danger" : "";
  const adminIcon = user.is_admin ? "bi-person-fill-gear" : "bi-person-circle";

  return (
    <>
    <Dropdown align="end" id="userDropdown">
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        className={`d-flex align-items-center gap-2 ${adminClass}`}
        id="userMenuDropdown"
      >
        <i className={`bi ${adminIcon}`}></i>
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

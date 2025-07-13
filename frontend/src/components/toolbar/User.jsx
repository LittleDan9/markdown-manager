import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNotification } from "../NotificationProvider";
import UserMenuLoggedIn from "./UserMenuLoggedIn";
import UserMenuLoggedOut from "./UserMenuLoggedOut";
import { useUser } from "../../context/UserContext";


function UserToolbar({ handleThemeToggle, theme }) {
  const { showSuccess, showError } = useNotification();
  const { user, setUser } = useUser();

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
        <UserMenuLoggedOut />
      )}
    </Dropdown>
    </>
  );
}

export default UserToolbar;

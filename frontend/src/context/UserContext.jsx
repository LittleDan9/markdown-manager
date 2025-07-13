// src/contexts/UserContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";

const defaultUser = {
  bio: "",
  created_at: "",
  display_name: "Guest",
  email: "",
  first_name: "",
  full_name: "",
  id: -1,
  is_active: false,
  is_verified: false,
  last_name: "",
  mfa_enabled: false,
  updated_at: "",
};

const UserContext = createContext({
  user: defaultUser,
  setUser: () => {}, // no-op default
});

export function UserProvider({ children }) {
  const [user, setUserState] = useState(defaultUser);

  // stable custom setter
  const setUser = useCallback((value) => {
    // only reset to default if undefined or null
    if (value == null) {
      setUserState(defaultUser);
    } else {
      const displayName = value.display_name?.trim();
      if (!displayName) {
        value.display_name = `${value.first_name || ""} ${value.last_name || ""}`.trim();
      }
      setUserState(value);
    }
  }, []);

  // memoize context value so consumers don't re-render on every provider render
  const contextValue = useMemo(
    () => ({ user, setUser }),
    [user, setUser]
  );

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}


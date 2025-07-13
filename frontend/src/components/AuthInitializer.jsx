// src/components/AuthInitializer.jsx
import { useEffect } from "react";
import { useUser } from "../context/UserContext";
import UserAPI from "../js/api/userApi";

function AuthInitializer() {
  const { setUser } = useUser();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    console.log("Token:", token);
    if (token && token !== "undefined" && token !== "null") {
      UserAPI.currentUser()
        .then(user => {
          setUser(user);
        })
        .catch((error) => {
          setUser(null);
        });
    } else {
      setUser(null);
    }
  }, [setUser]);

  return null;
}

export default AuthInitializer;
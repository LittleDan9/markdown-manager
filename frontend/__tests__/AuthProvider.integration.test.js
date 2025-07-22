import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../src/context/AuthProvider";
import userEvent from "@testing-library/user-event";

function TestLoginComponent() {
  const { login, user, isAuthenticated } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(null);

  const handleLogin = async () => {
    try {
      await login(email, password);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <input data-testid="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input data-testid="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button data-testid="login" onClick={handleLogin}>Login</button>
      <div data-testid="user">{user.display_name}</div>
      <div data-testid="auth">{isAuthenticated ? "yes" : "no"}</div>
      {error && <div data-testid="error">{error}</div>}
    </div>
  );
}

describe("AuthProvider integration", () => {
  it("logs in and updates user state", async () => {
    render(
      <AuthProvider>
        <TestLoginComponent />
      </AuthProvider>
    );
    userEvent.type(screen.getByTestId("email"), "test@example.com");
    userEvent.type(screen.getByTestId("password"), "password");
    userEvent.click(screen.getByTestId("login"));
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("yes"));
    expect(screen.getByTestId("user").textContent).not.toBe("Guest");
  });
});

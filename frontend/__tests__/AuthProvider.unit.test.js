import React from "react";
import { renderHook, act } from "@testing-library/react-hooks";
import { AuthProvider, useAuth } from "../src/context/AuthProvider";

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider unit", () => {
  it("provides default user and token state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user.display_name).toBe("Guest");
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("setUser updates user state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => {
      result.current.setUser({ ...result.current.user, display_name: "TestUser", id: 123 });
    });
    expect(result.current.user.display_name).toBe("TestUser");
    expect(result.current.user.id).toBe(123);
  });

  it("setToken updates token state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => {
      result.current.setToken("abc123");
    });
    expect(result.current.token).toBe("abc123");
    expect(localStorage.getItem("authToken")).toBe("abc123");
  });
});

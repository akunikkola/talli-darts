// Simple authentication utility
// Uses localStorage to remember login state per device

const AUTH_KEY = "talli-darts-auth";
const AUTH_TOKEN = "authenticated"; // Value stored when logged in

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === AUTH_TOKEN;
}

export function setAuthenticated(value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) {
    localStorage.setItem(AUTH_KEY, AUTH_TOKEN);
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

export function logout(): void {
  setAuthenticated(false);
}

// Check password against environment variable
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

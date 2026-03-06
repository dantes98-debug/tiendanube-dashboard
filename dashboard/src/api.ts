const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export interface Credentials {
  storeId: string;
  accessToken: string;
}

export function getCredentials(): Credentials | null {
  const raw = localStorage.getItem("tn_credentials");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials) {
  localStorage.setItem("tn_credentials", JSON.stringify(creds));
}

export function clearCredentials() {
  localStorage.removeItem("tn_credentials");
}

function headers(creds: Credentials | null): HeadersInit {
  if (!creds) return {};
  return {
    "x-store-id": creds.storeId,
    "x-access-token": creds.accessToken,
  };
}

export async function apiFetch<T>(path: string, creds: Credentials | null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(creds) });
  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

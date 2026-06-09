// Remembers the admin secret for this browser so an admin doesn't have to retype
// it every visit. Persisted to localStorage (same self-hosted, low-stakes threat
// model as membership.svelte.ts, where the board passphrase is also plaintext).
//
// "Remembered until the server admin changes the key": the stored secret stays
// put, but any admin request that comes back 401 means the key changed (or was
// wrong) — callers should `clearAdminSecret()` then, dropping us back to the
// unlock prompt.

const STORAGE_KEY = "barnabus.adminSecret";
const NAME_KEY = "barnabus.adminName";

export const adminState = $state<{ secret: string; authed: boolean; name: string }>({
  secret: localStorage.getItem(STORAGE_KEY) ?? "",
  // Whether the stored secret has been verified against the server this session.
  authed: false,
  // The admin's display name, stamped onto boards they create (shown on the
  // invite screen). Remembered so it doesn't need retyping per board.
  name: localStorage.getItem(NAME_KEY) ?? "",
});

export const setAdminSecret = (secret: string) => {
  adminState.secret = secret;
  localStorage.setItem(STORAGE_KEY, secret);
};

export const setAdminName = (name: string) => {
  adminState.name = name;
  localStorage.setItem(NAME_KEY, name);
};

export const clearAdminSecret = () => {
  adminState.secret = "";
  adminState.authed = false;
  localStorage.removeItem(STORAGE_KEY);
};

export const authHeader = () => ({ Authorization: `Bearer ${adminState.secret}` });

// Silently check the remembered secret against the server, updating `authed`.
// Used on the dashboard so admin-only affordances (copy-link) show without
// opening the panel. A 401 means the key was rotated/wrong — forget it.
export const verifyAdmin = async (): Promise<boolean> => {
  if (!adminState.secret) {
    adminState.authed = false;
    return false;
  }
  try {
    const res = await fetch("/api/admin/boards", { headers: authHeader() });
    if (res.status === 401) {
      clearAdminSecret();
      return false;
    }
    adminState.authed = res.ok;
    return res.ok;
  } catch {
    return false;
  }
};

// A join link for a board id — used by both the admin panel and (when authed)
// the "your boards" list on the dashboard.
export const joinLink = (id: string): string => `${location.origin}/?board=${id}`;

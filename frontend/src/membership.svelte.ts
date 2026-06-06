// Remembers the boards this browser has joined, so the picker can offer
// one-click reconnect. Persisted to localStorage.
//
// Security tradeoff (documented in the README per the plan): the passphrase is
// stored in PLAINTEXT here. For the self-hosted, low-stakes-table threat model
// that's the accepted price of "remember my boards".

const STORAGE_KEY = "barnabus.joinedBoards";

export type Membership = {
  boardId: string;
  // The board's display name (from the public lookup) — shown in the picker.
  name: string;
  passphrase: string;
  username: string;
};

const load = (): Membership[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const membership = $state<{ boards: Membership[] }>({
  boards: load(),
});

const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(membership.boards));
};

// Add or update a membership (keyed by boardId), moving it to the front.
export const remember = (entry: Membership) => {
  membership.boards = [
    entry,
    ...membership.boards.filter((b) => b.boardId !== entry.boardId),
  ];
  persist();
};

export const forget = (boardId: string) => {
  membership.boards = membership.boards.filter((b) => b.boardId !== boardId);
  persist();
};

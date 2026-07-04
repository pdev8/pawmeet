// Minimal in-memory stand-in for @react-native-async-storage/async-storage so
// the zustand store (its only native dependency) can be imported and exercised
// under Vitest. Covers the surface zustand's persist middleware uses.
const mem = new Map<string, string>();

export default {
  getItem: async (key: string): Promise<string | null> => (mem.has(key) ? mem.get(key)! : null),
  setItem: async (key: string, value: string): Promise<void> => {
    mem.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    mem.delete(key);
  },
  clear: async (): Promise<void> => {
    mem.clear();
  },
};

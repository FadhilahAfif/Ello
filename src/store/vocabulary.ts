import { create } from "zustand";
import { vocabularyList, vocabularyUpsert, vocabularyDelete, type VocabularyRule } from "../lib/invoke";

interface VocabularyStore {
  rules: VocabularyRule[];
  loading: boolean;
  error: string | null;
  loadRules: () => Promise<void>;
  addRule: (rule: Omit<VocabularyRule, "id">) => Promise<VocabularyRule>;
  updateRule: (rule: VocabularyRule & { id: number }) => Promise<VocabularyRule>;
  deleteRule: (id: number) => Promise<void>;
  setError: (e: string | null) => void;
}

export const useVocabularyStore = create<VocabularyStore>((set) => ({
  rules: [],
  loading: false,
  error: null,

  loadRules: async () => {
    set({ loading: true, error: null });
    try {
      const rules = await vocabularyList();
      set({ rules, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  addRule: async (rule) => {
    const newRule = await vocabularyUpsert({ ...rule, id: null });
    set((state) => ({ rules: [...state.rules, newRule] }));
    return newRule;
  },

  updateRule: async (rule) => {
    const updated = await vocabularyUpsert(rule);
    set((state) => ({
      rules: state.rules.map((r) => (r.id === rule.id ? updated : r)),
    }));
    return updated;
  },

  deleteRule: async (id) => {
    await vocabularyDelete(id);
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }));
  },

  setError: (e) => set({ error: e }),
}));

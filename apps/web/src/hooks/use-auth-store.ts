import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserInfo {
  id: string;
  email: string;
  username: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  activeCompanyId: string | null;
  hasHydrated: boolean;
  setAuth: (accessToken: string, refreshToken: string, user: UserInfo) => void;
  clearAuth: () => void;
  setActiveCompanyId: (companyId: string | null) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      activeCompanyId: null,
      hasHydrated: false,

      setAuth: (accessToken, refreshToken, user) => {
        set({ accessToken, refreshToken, user });
      },

      clearAuth: () => {
        set({ accessToken: null, refreshToken: null, user: null, activeCompanyId: null });
      },

      setActiveCompanyId: (companyId) => {
        set({ activeCompanyId: companyId });
      },

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },
    }),
    {
      name: "amdox-auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        activeCompanyId: state.activeCompanyId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);


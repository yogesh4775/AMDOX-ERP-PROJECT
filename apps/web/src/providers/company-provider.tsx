"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuthStore } from "../hooks/use-auth-store";
import { apiClient } from "../lib/api-client";

export interface Company {
  id: string;
  name: string;
  code: string;
  baseCurrency: string;
  country: string;
  isConsolidationEntity: boolean;
}

interface CompanyContextProps {
  companies: Company[];
  loading: boolean;
  refreshCompanies: () => Promise<void>;
}

interface CompanyHierarchyNode {
  id: string;
  name: string;
  code: string;
  baseCurrency: string;
  country: string;
  isConsolidationEntity: boolean;
  children?: CompanyHierarchyNode[];
}

interface ApiResponse<T> {
  data?: T;
}

const CompanyContext = createContext<CompanyContextProps | undefined>(
  undefined
);

export function CompanyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  const accessToken = useAuthStore((state) => state.accessToken);
  const activeCompanyId = useAuthStore((state) => state.activeCompanyId);
  const setActiveCompanyId = useAuthStore(
    (state) => state.setActiveCompanyId
  );

  const refreshCompanies = useCallback(async () => {
    if (!accessToken) {
      setCompanies([]);
      setActiveCompanyId(null);
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient<CompanyHierarchyNode[]>(
        "/consolidation/companies/hierarchy"
      );

      /*
       * Backend may return either:
       * 1. { data: [...] }
       * 2. [...]
       *
       * Support both formats.
       */
      const rawResponse = response as
        | CompanyHierarchyNode[]
        | ApiResponse<CompanyHierarchyNode[]>;

      const data = Array.isArray(rawResponse)
        ? rawResponse
        : rawResponse?.data;

      if (!Array.isArray(data)) {
        throw new Error(
          "Invalid company hierarchy response from server."
        );
      }

      // Flatten hierarchy for the company picker.
      const list: Company[] = [];

      const traverse = (node: CompanyHierarchyNode) => {
        list.push({
          id: node.id,
          name: node.name,
          code: node.code,
          baseCurrency: node.baseCurrency,
          country: node.country,
          isConsolidationEntity: node.isConsolidationEntity,
        });

        if (Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
      };

      data.forEach(traverse);

      setCompanies(list);

      // Select default company if current selection is invalid.
      if (list.length > 0) {
        const currentActiveId = useAuthStore.getState().activeCompanyId;
        const stillValid = list.some(
          (company) => company.id === currentActiveId
        );

        if (!stillValid) {
          setActiveCompanyId(list[0].id);
        }
      } else {
        setActiveCompanyId(null);
      }
    } catch (error) {
      console.error(
        "Failed to load company hierarchy:",
        error
      );

      // Do not destroy the existing company selection on a
      // temporary network/API failure.
    } finally {
      setLoading(false);
    }
  }, [accessToken, setActiveCompanyId]);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        loading,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error(
      "useCompany must be used within a CompanyProvider"
    );
  }

  return context;
}

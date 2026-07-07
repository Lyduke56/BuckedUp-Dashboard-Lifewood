"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Product } from "@/lib/types";
import { PRODUCTS } from "@/lib/mockData";

interface DashboardContextValue {
  products: Product[];
  /** Update (real-time sync stub): flips a video item's published state. */
  toggleVideoPublished: (productRank: number, itemId: string) => void;
  /**
   * Delete: removes a redundant or fully-completed product entry from the
   * dashboard, per the functional scope (Delete is authorized for
   * redundant/completed entries only — Create is never supported here).
   */
  removeProduct: (productRank: number) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  const toggleVideoPublished = useCallback(
    (productRank: number, itemId: string) => {
      setProducts((prev) =>
        prev.map((p) =>
          p.rank !== productRank
            ? p
            : {
                ...p,
                items: p.items.map((it) =>
                  it.id !== itemId ? it : { ...it, published: !it.published }
                ),
              }
        )
      );
    },
    []
  );

  const removeProduct = useCallback((productRank: number) => {
    setProducts((prev) => prev.filter((p) => p.rank !== productRank));
  }, []);

  const value = useMemo(
    () => ({ products, toggleVideoPublished, removeProduct }),
    [products, toggleVideoPublished, removeProduct]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return ctx;
}

import { useState, useEffect, useCallback } from "react";
import { getProducts } from "../../../renderer/services/productApi";
import type { Product } from "../../../renderer/types/product";

const LIMIT = 20;

async function waitForBackend(
  maxRetries = 30,
  delayMs = 2000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch("http://127.0.0.1:3000/health");
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = useCallback(async (p: number) => {
    setLoading(true);

    const backendReady = await waitForBackend();
    if (!backendReady) {
      setLoading(false);
      return;
    }

    for (let retry = 0; retry < 5; retry++) {
      try {
        const result = await getProducts(p, LIMIT);
        if (result.products.length > 0 || result.total > 0 || retry >= 4) {
          setProducts(result.products);
          setTotalPages(Math.ceil(result.total / LIMIT) || 1);
          setLoading(false);
          return;
        }
      } catch {
        // transient error, retry
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts(page);
  }, [page, fetchProducts]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
  }, []);

  return { products, loading, page, totalPages, goToPage, refetch: () => fetchProducts(page) };
}
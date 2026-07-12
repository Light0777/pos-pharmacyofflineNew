import { useState, useEffect, useCallback, useRef } from "react";
import { getProducts } from "../../../renderer/services/productApi";
import type { Product } from "../../../renderer/types/product";

const LIMIT = 20;

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const mountedRef = useRef(true);

  const fetchProducts = useCallback(async (p: number) => {
    setLoading(true);
    let attempts = 0;
    const maxAttempts = 120;
    while (attempts < maxAttempts) {
      if (!mountedRef.current) return;
      attempts++;
      try {
        const result = await getProducts(p, LIMIT);
        if (!mountedRef.current) return;
        setProducts(result.products);
        setTotalPages(Math.ceil(result.total / LIMIT) || 1);
        setLoading(false);
        return;
      } catch {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchProducts(page);
    return () => { mountedRef.current = false; };
  }, [page, fetchProducts]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
  }, []);

  const refetch = useCallback(() => {
    fetchProducts(page);
  }, [page, fetchProducts]);

  return { products, loading, page, totalPages, goToPage, refetch };
}

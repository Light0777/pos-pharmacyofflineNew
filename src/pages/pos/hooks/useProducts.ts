import { useState, useEffect, useCallback } from "react";
import { getProducts } from "../../../renderer/services/productApi";
import type { Product } from "../../../renderer/types/product";

const LIMIT = 20;

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = useCallback(async (p: number, retries = 2) => {
    setLoading(true);
    const result = await getProducts(p, LIMIT);
    if (result.products.length === 0 && result.total === 0 && retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchProducts(p, retries - 1);
    }
    setProducts(result.products);
    setTotalPages(Math.ceil(result.total / LIMIT) || 1);
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
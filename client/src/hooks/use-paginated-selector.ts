import { useState, useMemo } from "react";

interface UsePaginatedSelectorOptions<T> {
  items: T[];
  itemsPerPage?: number;
}

interface PaginatedSelectorResult<T> {
  currentItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => void;
  resetPagination: () => void;
}

export function usePaginatedSelector<T>({
  items,
  itemsPerPage = 10
}: UsePaginatedSelectorOptions<T>): PaginatedSelectorResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const goToNextPage = () => {
    console.log('[HOOK] goToNextPage chamado - hasNextPage:', hasNextPage, 'currentPage:', currentPage, 'totalPages:', totalPages);
    if (hasNextPage) {
      setCurrentPage(prev => {
        const newPage = prev + 1;
        console.log('[HOOK] Mudando de página', prev, 'para', newPage);
        return newPage;
      });
    }
  };

  const goToPreviousPage = () => {
    console.log('[HOOK] goToPreviousPage chamado - hasPreviousPage:', hasPreviousPage, 'currentPage:', currentPage);
    if (hasPreviousPage) {
      setCurrentPage(prev => {
        const newPage = prev - 1;
        console.log('[HOOK] Mudando de página', prev, 'para', newPage);
        return newPage;
      });
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const resetPagination = () => {
    setCurrentPage(1);
  };

  return {
    currentItems,
    currentPage,
    totalPages,
    totalItems,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    resetPagination
  };
}
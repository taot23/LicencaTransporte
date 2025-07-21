import { useState, useMemo } from 'react';

interface UsePaginatedListProps<T> {
  items: T[] | undefined;
  itemsPerPage?: number;
}

interface PaginationInfo {
  total: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  startItem: number;
  endItem: number;
}

interface UsePaginatedListReturn<T> {
  paginatedItems: T[];
  pagination: PaginationInfo;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredItems: T[];
}

export function usePaginatedList<T>({ 
  items = [], 
  itemsPerPage = 10 
}: UsePaginatedListProps<T>): UsePaginatedListReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Filtered items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    
    return items.filter((item: any) => {
      // Generic search function - searches through string values of the object
      return Object.values(item).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [items, searchTerm]);

  // Reset to first page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Pagination calculations
  const pagination = useMemo<PaginationInfo>(() => {
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, total);

    return {
      total,
      totalPages,
      currentPage,
      itemsPerPage,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
      startItem: total > 0 ? startItem : 0,
      endItem: total > 0 ? endItem : 0
    };
  }, [filteredItems.length, currentPage, itemsPerPage]);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage, itemsPerPage]);

  return {
    paginatedItems,
    pagination,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    filteredItems
  };
}
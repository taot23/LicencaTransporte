import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Hook para busca otimizada de veículos com paginação
export function useOptimizedVehicleSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const limit = 20; // Configurável via props se necessário
  
  const searchQuery = useQuery({
    queryKey: ['/api/vehicles/search', searchTerm, currentPage, sortBy, sortOrder, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      
      const response = await fetch(`/api/vehicles/search?${params}`);
      if (!response.ok) {
        throw new Error('Erro na busca de veículos');
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 segundos
    enabled: true, // Sempre habilitada, mas pode otimizar com debounce
  });
  
  // Debounce da busca para evitar muitas requisições
  const debouncedSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset para primeira página ao buscar
  }, []);
  
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  }, [sortBy]);
  
  return {
    vehicles: searchQuery.data?.vehicles || [],
    pagination: searchQuery.data?.pagination || {
      page: 1,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
    isLoading: searchQuery.isLoading,
    error: searchQuery.error,
    searchTerm,
    setSearchTerm: debouncedSearch,
    currentPage,
    setCurrentPage,
    sortBy,
    sortOrder,
    handleSort,
    refetch: searchQuery.refetch,
  };
}

// Hook para busca otimizada de transportadores
export function useOptimizedTransporterSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const limit = 20;
  
  const searchQuery = useQuery({
    queryKey: ['/api/transporters/search', searchTerm, currentPage, sortBy, sortOrder, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      
      const response = await fetch(`/api/transporters/search?${params}`);
      if (!response.ok) {
        throw new Error('Erro na busca de transportadores');
      }
      return response.json();
    },
    staleTime: 30 * 1000,
    enabled: true,
  });
  
  const debouncedSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);
  
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  }, [sortBy]);
  
  return {
    transporters: searchQuery.data?.transporters || [],
    pagination: searchQuery.data?.pagination || {
      page: 1,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
    isLoading: searchQuery.isLoading,
    error: searchQuery.error,
    searchTerm,
    setSearchTerm: debouncedSearch,
    currentPage,
    setCurrentPage,
    sortBy,
    sortOrder,
    handleSort,
    refetch: searchQuery.refetch,
  };
}

// Hook para busca global otimizada (navbar, etc)
export function useOptimizedGlobalSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const searchQuery = useQuery({
    queryKey: ['/api/search/global', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return { results: [] };
      
      const params = new URLSearchParams({
        q: searchTerm,
        limit: '15',
      });
      
      const response = await fetch(`/api/search/global?${params}`);
      if (!response.ok) {
        throw new Error('Erro na busca global');
      }
      return response.json();
    },
    staleTime: 10 * 1000, // 10 segundos para busca global
    enabled: searchTerm.length >= 2,
  });
  
  // Debounce inteligente: mais rápido para busca global
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (term: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSearchTerm(term);
      }, 300); // 300ms de debounce
    };
  }, []);
  
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setIsOpen(false);
  }, []);
  
  return {
    results: searchQuery.data?.results || [],
    isLoading: searchQuery.isLoading && searchTerm.length >= 2,
    error: searchQuery.error,
    searchTerm,
    setSearchTerm: debouncedSearch,
    isOpen,
    setIsOpen,
    clearSearch,
  };
}

// Hook para gerenciar cache de dados pesados
export function useOptimizedCache() {
  const queryClient = useQueryClient();
  
  const clearVehicleCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['/api/vehicles/search'] });
  }, [queryClient]);
  
  const clearTransporterCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['/api/transporters/search'] });
  }, [queryClient]);
  
  const clearGlobalSearchCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['/api/search/global'] });
  }, [queryClient]);
  
  const prefetchVehicles = useCallback((searchTerm: string, page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ['/api/vehicles/search', searchTerm, page, 'created_at', 'desc', 20],
      queryFn: async () => {
        const params = new URLSearchParams({
          search: searchTerm,
          page: page.toString(),
          limit: '20',
          sortBy: 'created_at',
          sortOrder: 'desc',
        });
        
        const response = await fetch(`/api/vehicles/search?${params}`);
        return response.json();
      },
      staleTime: 60 * 1000, // 1 minuto de prefetch
    });
  }, [queryClient]);
  
  return {
    clearVehicleCache,
    clearTransporterCache,
    clearGlobalSearchCache,
    prefetchVehicles,
  };
}
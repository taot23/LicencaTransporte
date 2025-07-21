import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./use-debounce";

export interface TransporterOption {
  id: number;
  name: string;
  tradeName?: string;
  personType: string;
  documentNumber?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
}

export function useOptimizedTransporterSelector() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300); // Reduzido para 300ms para melhor responsividade

  // Query otimizada para busca de transportadores
  const { data: transporters, isLoading, error } = useQuery({
    queryKey: ['/api/transporters/search', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        limit: '20' // Reduzido para 20 para melhor performance
      });
      
      const response = await fetch(`/api/transporters/search?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar transportadores');
      }
      const data = await response.json();
      return data.transporters as TransporterOption[];
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: true // Sempre habilitado para carregar lista inicial
  });

  // Helper para formatar label do transportador
  const formatTransporterLabel = (transporter: TransporterOption): string => {
    const parts = [transporter.name];
    if (transporter.documentNumber) {
      parts.push(`(${transporter.documentNumber})`);
    }
    if (transporter.city && transporter.state) {
      parts.push(`- ${transporter.city}/${transporter.state}`);
    }
    return parts.join(' ');
  };

  // Helper para obter transportador por ID
  const getTransporterById = (id: number): TransporterOption | undefined => {
    return transporters?.find(t => t.id === id);
  };

  // Filtrar transportadores baseado no termo de busca
  const filteredTransporters = transporters?.filter(transporter => {
    if (!debouncedSearch.trim()) return true;
    
    const search = debouncedSearch.toLowerCase().trim();
    const nameMatch = transporter.name.toLowerCase().includes(search);
    
    // Busca por CNPJ/CPF apenas se o termo contém números
    const numericSearch = search.replace(/\D/g, '');
    const documentMatch = numericSearch && transporter.documentNumber && 
                         transporter.documentNumber.replace(/\D/g, '').includes(numericSearch);
    
    return nameMatch || documentMatch;
  }) || [];

  return {
    // Estado
    searchTerm,
    setSearchTerm,
    isOpen,
    setIsOpen,
    
    // Dados
    transporters: filteredTransporters,
    isLoading,
    error,
    hasResults: filteredTransporters.length > 0,
    
    // Helpers
    formatTransporterLabel,
    getTransporterById
  };
}
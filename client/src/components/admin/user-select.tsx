import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@shared/schema";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCircle2, AlertCircle, Search, X } from "lucide-react";
import { usePaginatedSelector } from "@/hooks/use-paginated-selector";
import { PaginationControls } from "@/components/ui/pagination-controls";

// Definindo uma extensão do tipo User para incluir os campos adicionados pelo backend
interface EnhancedUser extends User {
  roleLabel?: string;
}

interface UserSelectProps {
  selectedUserId: number | null;
  onChange: (userId: number | null) => void;
  label?: string;
  description?: string;
  required?: boolean;
}

export function UserSelect({ 
  selectedUserId, 
  onChange, 
  label = "Usuário Vinculado", 
  description,
  required = false 
}: UserSelectProps) {
  const [value, setValue] = useState<string>(selectedUserId ? String(selectedUserId) : "");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // Buscar todos os usuários disponíveis para vinculação
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/admin/users");
        const allUsers = await response.json();
        console.log("[DEBUG] Todos os usuários carregados:", allUsers.length);
        // Filtrar apenas usuários que não são admin para vinculação com transportadores
        const nonAdminUsers = allUsers.filter((user: any) => user.role !== 'admin');
        console.log("[DEBUG] Usuários não-admin disponíveis:", nonAdminUsers.length);
        return nonAdminUsers as EnhancedUser[];
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        return [];
      }
    },
  });

  // Filtrar usuários baseado no termo de busca
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    
    return users.filter(user => 
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  // Obter usuário selecionado atual
  const selectedUser = useMemo(() => {
    return users.find(user => user.id === selectedUserId);
  }, [users, selectedUserId]);

  useEffect(() => {
    // Atualizar o valor quando selectedUserId mudar
    setValue(selectedUserId ? String(selectedUserId) : "");
    // Definir termo de busca como nome do usuário selecionado se houver
    if (selectedUser) {
      setSearchTerm(selectedUser.fullName || selectedUser.email);
    } else {
      setSearchTerm("");
    }
  }, [selectedUserId, selectedUser]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setShowDropdown(true);
    
    // Se limpar a busca, limpar seleção também
    if (!newSearchTerm.trim()) {
      setValue("");
      onChange(null);
    }
  };

  const handleUserSelect = (user: EnhancedUser) => {
    setValue(String(user.id));
    setSearchTerm(user.fullName || user.email);
    setShowDropdown(false);
    onChange(user.id);
  };

  const handleClear = () => {
    setValue("");
    setSearchTerm("");
    setShowDropdown(false);
    onChange(null);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleInputBlur = () => {
    // Delay para permitir click nos itens
    setTimeout(() => setShowDropdown(false), 200);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>}
        <div className="flex items-center justify-center h-10 border rounded-md px-3">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-500">Carregando usuários...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>Erro ao carregar usuários</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>}
      {description && <p className="text-sm text-gray-500 mb-2">{description}</p>}
      
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Digite o nome do usuário ou selecione..."
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Dropdown de resultados */}
        {showDropdown && filteredUsers.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredUsers.map((user: EnhancedUser) => (
              <div
                key={user.id}
                className="flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleUserSelect(user)}
              >
                <UserCircle2 size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.fullName || user.email}</div>
                  {user.fullName && (
                    <div className="text-sm text-gray-500 truncate">{user.email}</div>
                  )}
                </div>
                {(user.roleLabel || user.role) && (
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex-shrink-0">
                    {user.roleLabel || user.role}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mensagem quando não há resultados */}
        {showDropdown && searchTerm.trim() && filteredUsers.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
            <div className="text-center text-sm text-gray-500">
              Nenhum usuário encontrado para "{searchTerm}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "@shared/schema";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCircle2, AlertCircle, ChevronDown, X, Search, Check } from "lucide-react";
import { usePaginatedSelector } from "@/hooks/use-paginated-selector";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import { cn } from "@/lib/utils";

interface EnhancedUser extends User {
  roleLabel?: string;
}

interface PaginatedUserSelectProps {
  selectedUserId: number | null;
  onChange: (userId: number | null) => void;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function PaginatedUserSelect({ 
  selectedUserId, 
  onChange, 
  label = "Usuário Vinculado", 
  description,
  required = false,
  disabled = false,
  error
}: PaginatedUserSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown quando clicar fora
  useOnClickOutside(dropdownRef, () => setOpen(false));

  // Buscar todos os usuários disponíveis
  const { data: users = [], isLoading, error: queryError } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/admin/users");
        const allUsers = await response.json();
        // Filtrar usuários não-admin para vinculação com transportadores
        const nonAdminUsers = allUsers.filter((user: any) => user.role !== 'admin');
        return nonAdminUsers as EnhancedUser[];
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        return [];
      }
    },
  });

  // Filtrar usuários baseado no termo de busca
  const filteredUsers = users.filter(user => 
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginação dos usuários filtrados
  const {
    currentItems: paginatedUsers,
    currentPage,
    totalPages,
    totalItems,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    resetPagination
  } = usePaginatedSelector({
    items: filteredUsers,
    itemsPerPage: 8
  });

  // Resetar paginação quando busca mudar
  useEffect(() => {
    resetPagination();
  }, [searchTerm, resetPagination]);

  // Obter usuário selecionado
  const selectedUser = selectedUserId ? users.find(user => user.id === selectedUserId) : null;

  const handleSelect = (userId: number) => {
    onChange(userId);
    setOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    onChange(null);
    setSearchTerm("");
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      'user': 'Transportador',
      'operational': 'Operacional',
      'supervisor': 'Supervisor',
      'financial': 'Financeiro',
      'manager': 'Gerente',
      'admin': 'Administrador'
    };
    return roleLabels[role] || role;
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

  if (queryError) {
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

  const showError = error;

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}

      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Input
            value={selectedUser ? selectedUser.fullName || selectedUser.email : ""}
            onClick={() => !disabled && setOpen(true)}
            placeholder="Selecione um usuário..."
            disabled={disabled}
            readOnly
            className={cn(
              "pr-20 cursor-pointer",
              showError && "border-red-300 focus:border-red-300 focus:ring-red-200"
            )}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {selectedUser && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={handleClear}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={() => setOpen(!open)}
              disabled={disabled}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Dropdown absoluto */}
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-hidden">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, email ou função..."
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {filteredUsers.length === 0 && searchTerm && (
                <div className="flex flex-col items-center justify-center py-6">
                  <UserCircle2 className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    Nenhum usuário encontrado para "{searchTerm}"
                  </p>
                </div>
              )}
              
              {filteredUsers.length === 0 && !searchTerm && (
                <div className="flex flex-col items-center justify-center py-6">
                  <Search className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    Digite para buscar usuários
                  </p>
                </div>
              )}

              {paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between cursor-pointer p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelect(user.id)}
                >
                  <div className="flex items-center gap-3">
                    <UserCircle2 className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {user.fullName || user.email}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {user.email}
                      </div>
                      <div className="text-xs text-gray-400">
                        {getRoleLabel(user.role)}
                        {user.phone && ` • ${user.phone}`}
                      </div>
                    </div>
                  </div>
                  
                  {selectedUserId === user.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            
            {/* Controles de paginação */}
            {filteredUsers.length > 0 && totalPages > 1 && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-2 py-1">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={8}
                  onPreviousPage={goToPreviousPage}
                  onNextPage={goToNextPage}
                  hasPreviousPage={hasPreviousPage}
                  hasNextPage={hasNextPage}
                  size="sm"
                  showItemCount={true}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {showError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <X className="h-3 w-3" />
          {showError}
        </p>
      )}
      
      {selectedUser && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
          <div className="font-medium">{selectedUser.fullName || selectedUser.email}</div>
          <div className="text-xs text-gray-500 mt-1">
            {getRoleLabel(selectedUser.role)} • {selectedUser.email}
          </div>
          {selectedUser.phone && (
            <div className="text-xs text-gray-500">
              Telefone: {selectedUser.phone}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
#!/bin/bash

echo "🚀 APLICANDO CORREÇÕES NO SERVIDOR GOOGLE CLOUD"
echo "=============================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 INSTRUÇÕES PARA O SERVIDOR:${NC}"
echo ""
echo "1. Conecte ao servidor:"
echo "   ssh servidorvoipnvs@34.44.159.254"
echo ""
echo "2. Navegue para o diretório:"
echo "   cd /var/www/aetlicensesystem/LicencaTransporte"
echo ""
echo "3. Pare o PM2:"
echo "   pm2 stop all"
echo ""
echo "4. Execute os comandos abaixo um por um:"
echo ""

# Backup dos arquivos
echo -e "${GREEN}# FAZER BACKUP DOS ARQUIVOS${NC}"
echo "cp client/src/components/licenses/license-form.tsx client/src/components/licenses/license-form.tsx.backup"
echo "cp client/src/components/admin/user-select.tsx client/src/components/admin/user-select.tsx.backup"
echo ""

# Correção 1: user-select.tsx
echo -e "${GREEN}# CORRIGIR user-select.tsx${NC}"
cat << 'EOF_USER_SELECT' > /tmp/user-select-fix.txt
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface User {
  id: number;
  email: string;
  name: string;
}

interface UserSelectProps {
  value?: number | null;
  onValueChange: (value: number | null) => void;
  users: User[];
  placeholder?: string;
  className?: string;
}

export function UserSelect({
  value,
  onValueChange,
  users,
  placeholder = "Selecione um usuário...",
  className,
}: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Debug: log all available users
  console.log("🔍 [DEBUG] Todos os usuários disponíveis:", users);
  console.log("🔍 [DEBUG] Quantidade total de usuários:", users?.length || 0);

  const filteredUsers = users?.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const selectedUser = users?.find(user => user.id === value);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedUser ? (
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {selectedUser.name} ({selectedUser.email})
                </span>
              </div>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput 
              placeholder="Buscar usuário..." 
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-[200px]">
                <CommandItem
                  value=""
                  onSelect={() => {
                    onValueChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Nenhum usuário
                </CommandItem>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email}`}
                    onSelect={() => {
                      onValueChange(user.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <User className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
EOF_USER_SELECT

echo "cat > client/src/components/admin/user-select.tsx << 'EOF_USER_SELECT'"
cat /tmp/user-select-fix.txt
echo "EOF_USER_SELECT"
echo ""

# Correção 2: Verificar vinculações no banco
echo -e "${GREEN}# VERIFICAR VINCULAÇÕES NO BANCO${NC}"
echo 'psql -h localhost -U aetuser -d aetlicensesystem -c "'
echo "SELECT u.id as user_id, u.email, u.name, t.id as transporter_id, t.name as transporter_name"
echo "FROM users u"
echo "LEFT JOIN transporters t ON t.user_id = u.id"
echo "WHERE u.email IN ('teste2@teste.com', 'fiscal@nscaravaggio.com.br')"
echo "ORDER BY u.id;"
echo '"'
echo ""

# Correção 3: Corrigir vinculações se necessário
echo -e "${GREEN}# CORRIGIR VINCULAÇÕES (SE NECESSÁRIO)${NC}"
echo 'psql -h localhost -U aetuser -d aetlicensesystem -c "'
echo "UPDATE transporters SET user_id = (SELECT id FROM users WHERE email = 'teste2@teste.com') WHERE name LIKE '%LIMESTONE%';"
echo "UPDATE transporters SET user_id = (SELECT id FROM users WHERE email = 'fiscal@nscarravaggio.com.br') WHERE name LIKE '%CARAVAGGIO%';"
echo '"'
echo ""

# Reiniciar serviços
echo -e "${GREEN}# REINICIAR SERVIÇOS${NC}"
echo "pm2 start ecosystem.config.js"
echo "pm2 logs --lines 10"
echo ""

echo -e "${BLUE}5. TESTAR A APLICAÇÃO:${NC}"
echo "   - Acesse: http://34.44.159.254:5000"
echo "   - Login: teste2@teste.com"
echo "   - Clique em 'Solicitar AET'"
echo "   - Deve aparecer o transportador LIMESTONE"
echo ""

echo -e "${GREEN}✅ SCRIPT PRONTO! Execute esses comandos no seu servidor.${NC}"
import { useState, useEffect } from "react";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Edit3, Eye, FileText } from "lucide-react";

interface UserActivity {
  userId: number;
  userName: string;
  userEmail: string;
  action: 'viewing' | 'editing' | 'commenting';
  licenseId?: number;
  state?: string;
  timestamp: number;
  avatar?: string;
}

interface CollaborationBubblesProps {
  licenseId?: number;
  state?: string;
  className?: string;
}

export function CollaborationBubbles({ licenseId, state, className = "" }: CollaborationBubblesProps) {
  const [activeUsers, setActiveUsers] = useState<UserActivity[]>([]);
  const { lastMessage, sendMessage } = useWebSocketContext();

  // Filtrar usuários ativos baseado no contexto (licença específica ou estado)
  const relevantUsers = activeUsers.filter(user => {
    if (licenseId && state) {
      return user.licenseId === licenseId && user.state === state;
    } else if (licenseId) {
      return user.licenseId === licenseId;
    }
    return true; // Mostrar todos se não houver filtros
  });

  // Agrupar usuários por ação
  const usersByAction = relevantUsers.reduce((acc, user) => {
    if (!acc[user.action]) acc[user.action] = [];
    acc[user.action].push(user);
    return acc;
  }, {} as Record<string, UserActivity[]>);

  useEffect(() => {
    // Processar mensagens de atividade recebidas via WebSocket
    if (lastMessage?.type === 'USER_ACTIVITY') {
      const activity = lastMessage.data as UserActivity;
      
      setActiveUsers(prev => {
        // Remove atividade anterior do mesmo usuário no mesmo contexto
        const filtered = prev.filter(user => 
          !(user.userId === activity.userId && 
            user.licenseId === activity.licenseId && 
            user.state === activity.state)
        );
        
        // Adiciona nova atividade
        return [...filtered, { ...activity, timestamp: Date.now() }];
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    // Limpar atividades antigas a cada 30 segundos
    const interval = setInterval(() => {
      const thirtySecondsAgo = Date.now() - 30000;
      setActiveUsers(prev => prev.filter(user => user.timestamp > thirtySecondsAgo));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Enviar atividade quando o componente é montado ou o contexto muda
  useEffect(() => {
    if (licenseId) {
      sendMessage({
        type: 'USER_ACTIVITY',
        data: {
          action: 'viewing',
          licenseId,
          state
        }
      });
    }
  }, [licenseId, state, sendMessage]);

  if (relevantUsers.length === 0) {
    return null;
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'editing': return <Edit3 className="h-3 w-3" />;
      case 'commenting': return <FileText className="h-3 w-3" />;
      default: return <Eye className="h-3 w-3" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'editing': return 'bg-green-500';
      case 'commenting': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'editing': return 'Editando';
      case 'commenting': return 'Comentando';
      default: return 'Visualizando';
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-1">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600 font-medium">
            {relevantUsers.length} {relevantUsers.length === 1 ? 'usuário' : 'usuários'} ativo{relevantUsers.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <AnimatePresence>
          {Object.entries(usersByAction).map(([action, users]) => (
            <motion.div
              key={action}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center space-x-1"
            >
              <Badge variant="outline" className="flex items-center space-x-1 px-2 py-1">
                <div className={`w-2 h-2 rounded-full ${getActionColor(action)}`} />
                {getActionIcon(action)}
                <span className="text-xs">{getActionLabel(action)}</span>
                <span className="text-xs font-bold">{users.length}</span>
              </Badge>
              
              <div className="flex -space-x-1">
                {users.slice(0, 3).map((user, index) => (
                  <Tooltip key={`${user.userId}-${index}`}>
                    <TooltipTrigger>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Avatar className="h-6 w-6 border-2 border-white">
                          <AvatarImage src={user.avatar} alt={user.userName} />
                          <AvatarFallback className="text-xs">
                            {user.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <p className="font-medium">{user.userName}</p>
                        <p className="text-xs text-gray-500">{user.userEmail}</p>
                        <p className="text-xs">{getActionLabel(action)}</p>
                        {user.state && (
                          <p className="text-xs text-blue-600">Estado: {user.state}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                {users.length > 3 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-600">+{users.length - 3}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div>
                        <p className="font-medium">Mais {users.length - 3} usuários</p>
                        <div className="mt-1 space-y-1">
                          {users.slice(3).map(user => (
                            <p key={user.userId} className="text-xs">{user.userName}</p>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
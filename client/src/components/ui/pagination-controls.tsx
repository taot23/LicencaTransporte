import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  showItemCount?: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPreviousPage,
  onNextPage,
  hasPreviousPage,
  hasNextPage,
  className,
  size = "sm",
  showItemCount = true
}: PaginationControlsProps) {
  const startItem = ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const buttonSizeClass = {
    sm: "h-7 px-2 text-xs",
    md: "h-9 px-3 text-sm", 
    lg: "h-11 px-4 text-base"
  }[size];

  const textSizeClass = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }[size];

  if (totalItems === 0) return null;

  return (
    <div className={cn("flex items-center justify-between gap-2 py-2", className)}>
      {showItemCount && (
        <div className={cn("text-gray-600", textSizeClass)}>
          Mostrando {startItem}-{endItem} de {totalItems} itens
        </div>
      )}
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
          className={cn("flex items-center gap-1", buttonSizeClass)}
        >
          <ChevronLeft className="h-3 w-3" />
          Anterior
        </Button>
        
        <div className={cn("mx-2 text-gray-600 font-medium", textSizeClass)}>
          Página {currentPage} de {totalPages}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onNextPage}
          disabled={!hasNextPage}
          className={cn("flex items-center gap-1", buttonSizeClass)}
        >
          Próxima
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  startItem: number;
  endItem: number;
  itemName?: string; // Nome do item para exibição (ex: "veículos", "licenças", "usuários")
}

export function ListPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  hasPrev,
  hasNext,
  startItem,
  endItem,
  itemName = "itens"
}: ListPaginationProps) {
  // Se só há uma página, não mostrar paginação
  if (totalPages <= 1) return null;

  const handlePreviousPage = () => {
    if (hasPrev) {
      onPageChange(Math.max(1, currentPage - 1));
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      onPageChange(Math.min(totalPages, currentPage + 1));
    }
  };

  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-white">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Mostrando{" "}
          <span className="font-medium">
            {startItem}-{endItem}
          </span>{" "}
          de{" "}
          <span className="font-medium">
            {totalItems}
          </span>{" "}
          {itemName}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!hasPrev}
            className="flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          
          <span className="text-sm font-medium px-3">
            Página {currentPage} de {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasNext}
            className="flex items-center"
          >
            Próxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Versão mobile da paginação
interface MobileListPaginationProps extends ListPaginationProps {}

export function MobileListPagination(props: MobileListPaginationProps) {
  const {
    currentPage,
    totalPages,
    totalItems,
    onPageChange,
    hasPrev,
    hasNext,
    startItem,
    endItem,
    itemName = "itens"
  } = props;

  // Se só há uma página, não mostrar paginação
  if (totalPages <= 1) return null;

  const handlePreviousPage = () => {
    if (hasPrev) {
      onPageChange(Math.max(1, currentPage - 1));
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      onPageChange(Math.min(totalPages, currentPage + 1));
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-600">
          Página {currentPage} de {totalPages}
        </span>
        <span className="text-sm text-gray-600">
          {startItem}-{endItem} de {totalItems} {itemName}
        </span>
      </div>
      
      <div className="flex justify-center items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousPage}
          disabled={!hasPrev}
          className="flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        
        <span className="text-sm font-medium px-2">
          {currentPage}/{totalPages}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          disabled={!hasNext}
          className="flex items-center"
        >
          Próxima
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
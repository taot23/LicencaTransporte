import { Button } from "@/components/ui/button";

interface StandardPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  startItem: number;
  endItem: number;
  itemName: string;
  performanceTime?: string;
  showPageSizeSelect?: boolean;
}

export function StandardPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hasPrev,
  hasNext,
  startItem,
  endItem,
  itemName,
  performanceTime,
  showPageSizeSelect = true
}: StandardPaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Mostrando {startItem} a {endItem} de {totalItems} {itemName}
        {performanceTime && (
          <span className="ml-2 text-green-600 font-mono">
            {performanceTime}ms
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {showPageSizeSelect && pageSize && onPageSizeChange && (
          <select 
            value={pageSize} 
            onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={10}>10 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        )}
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!hasPrev}
          >
            ««
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrev}
          >
            ‹
          </Button>
          <span className="text-sm px-3">
            {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNext}
          >
            ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNext}
          >
            »»
          </Button>
        </div>
      </div>
    </div>
  );
}
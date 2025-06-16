/**
 * Utilitário para exportação de dados em formato CSV
 */

export interface CSVExportOptions {
  filename: string;
  headers: string[];
  data: any[];
  formatters?: Record<string, (value: any) => string>;
}

/**
 * Converte dados para formato CSV e faz download do arquivo
 */
export function exportToCSV(options: CSVExportOptions): void {
  const { filename, headers, data, formatters = {} } = options;

  if (!data || data.length === 0) {
    throw new Error("Nenhum dado para exportar");
  }

  // Cria as linhas do CSV
  const csvData = data.map(item => {
    return headers.map(header => {
      const key = header.toLowerCase().replace(/\s+/g, '');
      let value = item[key] || item[header] || '';
      
      // Aplica formatador se disponível
      if (formatters[key]) {
        value = formatters[key](value);
      }
      
      // Converte para string e escapa aspas
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    });
  });

  // Monta o conteúdo CSV com separador de ponto e vírgula (;)
  console.log('[CSV Export] Usando separador ponto e vírgula (;)');
  const csvContent = [
    headers.map(h => `"${h}"`).join(";"),
    ...csvData.map(row => row.join(";"))
  ].join("\n");

  // Cria e baixa o arquivo
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formata data para exibição em CSV no formato brasileiro
 */
export function formatDateForCSV(date: string | Date): string {
  if (!date) return '';
  
  try {
    let d: Date;
    
    if (typeof date === "string") {
      // Se a string contém 'T', é ISO format
      if (date.includes('T')) {
        d = new Date(date);
      } else {
        // Se é formato YYYY-MM-DD, processar diretamente
        const parts = date.split('-');
        if (parts.length === 3) {
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          d = new Date(date);
        }
      }
    } else {
      d = date;
    }
    
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return '';
    }
    
    return d.toLocaleDateString('pt-BR', {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (error) {
    console.error("Erro ao formatar data para CSV:", error, date);
    return '';
  }
}

/**
 * Formata moeda para exibição em CSV
 */
export function formatCurrencyForCSV(value: string | number): string {
  if (!value) return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue);
}

/**
 * Formata status para exibição legível
 */
export function formatStatusForCSV(status: string): string {
  const statusMap: Record<string, string> = {
    'pending_registration': 'Pendente de Registro',
    'registration_in_progress': 'Registro em Andamento',
    'under_review': 'Em Análise',
    'pending_approval': 'Pendente de Aprovação',
    'approved': 'Aprovado',
    'rejected': 'Rejeitado',
    'canceled': 'Cancelado',
    'aguardando_pagamento': 'Aguardando Pagamento',
    'pago': 'Pago',
    'vencido': 'Vencido',
    'active': 'Ativo',
    'inactive': 'Inativo'
  };
  
  return statusMap[status] || status;
}
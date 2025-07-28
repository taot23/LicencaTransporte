import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from "lucide-react";

export default function BulkVehiclesPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Timeout aumentado para 10 minutos para arquivos grandes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutos
      
      try {
        const response = await fetch("/api/vehicles/bulk-import", {
          method: "POST",
          body: formData,
          credentials: "include",
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Erro desconhecido" }));
          throw new Error(errorData.message || "Erro ao processar arquivo CSV");
        }
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error("Tempo limite excedido. Arquivo muito grande ou processamento demorado.");
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      setImportResult(result);
      if (result.success) {
        toast({
          title: "Importação concluída",
          description: `${result.inserted} veículos importados com sucesso`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao processar arquivo CSV",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setCsvFile(file);
    setImportResult(null);
    
    // Preview dos primeiros registros
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 6); // Primeira linha (header) + 5 linhas de dados
      const preview = lines.map(line => line.split(';'));
      setPreviewData(preview);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      handleFileSelect(file);
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV válido",
        variant: "destructive",
      });
    }
  };

  const onSubmit = () => {
    console.log('[FRONTEND] onSubmit chamado, csvFile:', csvFile);
    
    if (!csvFile) {
      toast({
        title: "Arquivo necessário",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('csvFile', csvFile);
    
    console.log('[FRONTEND] FormData criado:', {
      hasFile: formData.has('csvFile'),
      fileName: csvFile.name,
      fileSize: csvFile.size
    });
    
    importMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const template = [
      'placa;tipo_veiculo;tipo_carroceria;marca;modelo;ano_fabricacao;ano_crlv;renavam;cmt;tara;eixo;transportador_cpf_cnpj',
      'ABC1D23;Unidade Tratora (Cavalo);;Scania;R440;2018;2024;12345678901;45000;10500;5;12345678000199',
      'DEF4E56;Semirreboque;Container;Randon;RK-430SR;2019;2024;12345678902;25000;8500;3;12345678000199',
      'GHI7J89;Reboque;Prancha;Facchini;FB-2SR;2020;2024;12345678903;30000;9000;3;12345678000199'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_veiculos.csv';
    link.click();
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadastro em Massa de Veículos</h1>
            <p className="text-muted-foreground">
              Importe múltiplos veículos através de arquivo CSV
            </p>
          </div>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Baixar Modelo
          </Button>
        </div>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Como usar o cadastro em massa
            </CardTitle>
            <CardDescription>
              Siga os passos abaixo para importar seus veículos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                  1
                </div>
                <h4 className="font-semibold mb-1">Baixar Modelo</h4>
                <p className="text-sm text-muted-foreground">
                  Clique em "Baixar Modelo" para obter o arquivo CSV com o formato correto
                </p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                  2
                </div>
                <h4 className="font-semibold mb-1">Preencher Dados</h4>
                <p className="text-sm text-muted-foreground">
                  Complete o arquivo com os dados dos seus veículos seguindo o formato
                </p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                  3
                </div>
                <h4 className="font-semibold mb-1">Fazer Upload</h4>
                <p className="text-sm text-muted-foreground">
                  Arraste o arquivo preenchido ou clique para selecionar
                </p>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> 
                Certifique-se de que os CPF/CNPJ dos transportadores já estão cadastrados no sistema.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle>Upload do Arquivo CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    Arraste seu arquivo CSV aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Apenas arquivos .csv são aceitos
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>

              {csvFile && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo selecionado: <strong>{csvFile.name}</strong> ({(csvFile.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={onSubmit}
                disabled={!csvFile || importMutation.isPending}
                className="w-full"
              >
                {importMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-r-transparent"></div>
                    Processando arquivo... (pode levar alguns minutos)
                  </div>
                ) : (
                  "Importar Veículos"
                )}
              </Button>
              
              {importMutation.isPending && csvFile && (
                <Alert className="mt-4">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Processando {csvFile.name}</strong></p>
                      <p>Arquivo de {(csvFile.size / 1024).toFixed(2)} KB sendo processado...</p>
                      <p className="text-sm text-muted-foreground">
                        Arquivos grandes podem levar até 10 minutos para processar completamente.
                        Por favor, aguarde sem fechar a página.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview dos Dados</CardTitle>
              <CardDescription>
                Primeiros registros do arquivo (máximo 5 linhas)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData[0]?.map((header: string, index: number) => (
                        <TableHead key={index} className="whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(1).map((row: string[], index: number) => (
                      <TableRow key={index}>
                        {row.map((cell: string, cellIndex: number) => (
                          <TableCell key={cellIndex} className="whitespace-nowrap">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultado da Importação */}
        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Resultado da Importação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!importResult.success && importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold mb-2">Erros encontrados:</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Linha {error.row}:</strong> {error.error}
                          {error.data?.placa && (
                            <span className="block text-sm mt-1">
                              Placa: {error.data.placa}
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {importResult.success && importResult.inserted > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Importação concluída com sucesso! Os veículos já estão disponíveis no sistema.
                    Você pode agora fazer o upload dos documentos individualmente através da página de veículos.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
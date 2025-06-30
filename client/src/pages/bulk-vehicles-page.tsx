import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MainLayout } from "@/components/layout/main-layout";

interface ImportResult {
  success: boolean;
  inserted: number;
  errors: ImportError[];
  validVehicles: any[];
}

interface ImportError {
  row: number;
  data: any;
  error: string;
}

export function BulkVehiclesPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/vehicles/bulk-import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Erro ao processar arquivo CSV");
      }
      return response.json();
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
    importMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const template = [
      'placa;tipo_veiculo;marca;modelo;ano_fabricacao;ano_crlv;chassi;renavam;cmt;tara;eixo;transportador_cpf_cnpj',
      'ABC1D23;Unidade Tratora (Cavalo);Scania;R440;2018;2024;9BWZZZ377VT004251;12345678901;45000;10500;5;12345678000199',
      'DEF4E56;Primeira Carreta;Randon;RK-430SR;2019;2024;9BWZZZ377VT004252;12345678902;25000;8500;3;12345678000199'
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
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Baixe o modelo</h3>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Baixar Modelo" para obter a planilha com formato correto
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Preencha os dados</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete a planilha com os dados dos veículos e salve como CSV
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Faça o upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Arraste o arquivo ou clique para selecionar e importar
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> O arquivo deve estar em formato CSV com separador ";" (ponto e vírgula).
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                type="submit"
                disabled={!csvFile || importMutation.isPending}
                className="w-full"
              >
                {importMutation.isPending ? "Processando..." : "Importar Veículos"}
              </Button>
            </form>
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
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="outline" className="text-green-600">
                  {importResult.inserted} importados
                </Badge>
                {importResult.errors.length > 0 && (
                  <Badge variant="outline" className="text-red-600">
                    {importResult.errors.length} erros
                  </Badge>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div>
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
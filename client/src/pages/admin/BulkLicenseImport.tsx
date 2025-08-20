import { useState, useRef } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
  warnings: string[];
}

export default function BulkLicenseImport() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo do arquivo
      if (!file.name.endsWith('.csv')) {
        alert('Por favor, selecione um arquivo CSV');
        return;
      }
      
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/licenses/bulk-import/template');
      if (!response.ok) {
        throw new Error('Erro ao baixar template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_importacao_licencas.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar template:', error);
      alert('Erro ao baixar template da planilha');
    }
  };

  const importLicenses = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setUploadProgress(0);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);

      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/admin/licenses/bulk-import', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        // Resetar formulário se sucesso
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

    } catch (error) {
      console.error('Erro na importação:', error);
      setImportResult({
        success: false,
        message: 'Erro de conexão com o servidor',
        imported: 0,
        errors: ['Erro de conexão. Tente novamente.'],
        warnings: []
      });
    } finally {
      setImporting(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Importação em Massa de Licenças</h1>
          <p className="text-gray-600 mt-2">
            Importe várias licenças AET de uma só vez usando uma planilha CSV
          </p>
        </div>

      {/* Instruções */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Como usar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">1. Baixe o Template</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Baixe a planilha modelo com as colunas corretas e um exemplo de preenchimento.
                </p>
                <Button onClick={downloadTemplate} variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Template CSV
                </Button>
              </div>
              <div>
                <h4 className="font-semibold mb-2">2. Preencha os Dados</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Complete a planilha com os dados das licenças. Todos os veículos e transportadores devem estar cadastrados.
                </p>
                <div className="text-xs text-gray-500">
                  <p>• Use ponto e vírgula (;) como separador</p>
                  <p>• Vírgulas decimais podem usar ',' ou '.'</p>
                  <p>• Estados separados por vírgula (SP,MG,RJ)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload de Arquivo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload da Planilha</CardTitle>
          <CardDescription>
            Faça upload do arquivo CSV com os dados das licenças
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-green-600" />
                <div>
                  <p className="font-semibold">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    variant="outline"
                  >
                    Escolher Outro Arquivo
                  </Button>
                  <Button 
                    onClick={importLicenses}
                    disabled={importing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {importing ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Importar Licenças
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 mx-auto text-gray-400" />
                <div>
                  <p className="text-lg font-semibold">Arraste o arquivo CSV aqui</p>
                  <p className="text-gray-600">ou clique para selecionar</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Selecionar Arquivo
                </Button>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {importing && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Processando...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

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
            <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <AlertDescription>
                {importResult.message}
              </AlertDescription>
            </Alert>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{importResult.imported}</div>
                <div className="text-sm text-blue-600">Licenças Importadas</div>
              </div>
              
              {importResult.warnings.length > 0 && (
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{importResult.warnings.length}</div>
                  <div className="text-sm text-yellow-600">Avisos</div>
                </div>
              )}
              
              {importResult.errors.length > 0 && (
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                  <div className="text-sm text-red-600">Erros</div>
                </div>
              )}
            </div>

            {(importResult.warnings.length > 0 || importResult.errors.length > 0) && (
              <div className="mt-6 space-y-4">
                {importResult.warnings.length > 0 && (
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      Avisos ({importResult.warnings.length})
                    </h4>
                    <ScrollArea className="h-24 w-full border rounded p-2 bg-yellow-50">
                      {importResult.warnings.map((warning, index) => (
                        <div key={index} className="text-sm text-yellow-700 mb-1">
                          {warning}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      Erros ({importResult.errors.length})
                    </h4>
                    <ScrollArea className="h-32 w-full border rounded p-2 bg-red-50">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-700 mb-1">
                          {error}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações Importantes */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Tipos</Badge>
              <div>
                <strong>Tipos de conjunto aceitos:</strong> Bitrem 6 eixos, Bitrem 7 eixos, Bitrem 9 eixos, Rodotrem 7 eixos, Rodotrem 9 eixos, Prancha, Romeu e Julieta
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Veículos</Badge>
              <div>
                <strong>Veículos obrigatórios:</strong> Todos os veículos mencionados na planilha devem estar cadastrados no sistema antes da importação
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Validação</Badge>
              <div>
                <strong>Verificação de duplicatas:</strong> O sistema verifica automaticamente se já existe licença similar para a mesma combinação de veículos
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Estados</Badge>
              <div>
                <strong>Estados válidos:</strong> AC, AL, AP, AM, BA, CE, DF, ES, GO, MG, MS, MT, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SE, SP, TO, DNIT, ANTT, PRF
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
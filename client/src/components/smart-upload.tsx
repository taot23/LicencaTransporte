import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadedFile {
  file: File;
  preview?: string;
  type: 'pdf' | 'image';
}

interface SmartUploadProps {
  onFileChange: (file: File | null) => void;
  accept?: string;
  maxSize?: number;
  label: string;
  description?: string;
  currentFileUrl?: string;
  currentFileName?: string;
}

export function SmartUpload({
  onFileChange,
  accept = ".pdf",
  maxSize = 10 * 1024 * 1024, // 10MB
  label,
  description,
  currentFileUrl,
  currentFileName
}: SmartUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Tratar arquivos rejeitados
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles[0].errors;
      if (errors.some((e: any) => e.code === 'file-too-large')) {
        toast({
          title: "Arquivo muito grande",
          description: `O arquivo deve ter no máximo ${Math.round(maxSize / 1024 / 1024)}MB`,
          variant: "destructive",
        });
      } else if (errors.some((e: any) => e.code === 'file-invalid-type')) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Apenas arquivos PDF são aceitos",
          variant: "destructive",
        });
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
      
      const newUploadedFile: UploadedFile = {
        file,
        type: fileType
      };

      // Criar preview para imagens
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = () => {
          newUploadedFile.preview = reader.result as string;
          setUploadedFile(newUploadedFile);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadedFile(newUploadedFile);
      }

      onFileChange(file);
      toast({
        title: "Arquivo carregado",
        description: `${file.name} foi carregado com sucesso`,
      });
    }
  }, [maxSize, onFileChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize,
    multiple: false
  });

  const removeFile = () => {
    setUploadedFile(null);
    onFileChange(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openPreview = () => {
    if (uploadedFile?.type === 'pdf') {
      // Para PDFs, criar URL temporária
      const url = URL.createObjectURL(uploadedFile.file);
      window.open(url, '_blank');
    } else if (uploadedFile?.preview) {
      setPreviewOpen(true);
    } else if (currentFileUrl) {
      window.open(currentFileUrl, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mb-3">{description}</p>
        )}
      </div>

      {/* Área de upload */}
      {!uploadedFile && !currentFileUrl && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`
                cursor-pointer transition-colors duration-200 ease-in-out text-center
                ${isDragActive ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              
              {isDragActive ? (
                <p className="text-blue-600 font-medium">
                  Solte o arquivo aqui...
                </p>
              ) : (
                <>
                  <p className="text-gray-600 font-medium mb-2">
                    Arraste e solte seu arquivo aqui
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    ou clique para selecionar
                  </p>
                  <Button type="button" variant="outline" size="sm">
                    Selecionar Arquivo
                  </Button>
                </>
              )}
              
              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>Formatos aceitos: PDF</p>
                <p>Tamanho máximo: {Math.round(maxSize / 1024 / 1024)}MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arquivo carregado */}
      {(uploadedFile || currentFileUrl) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {uploadedFile?.file.name || currentFileName || "Arquivo atual"}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      PDF
                    </Badge>
                    {uploadedFile && (
                      <span className="text-xs text-gray-500">
                        {formatFileSize(uploadedFile.file.size)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPreview}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Visualizar
                </Button>
                
                {uploadedFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Substituir arquivo atual */}
      {currentFileUrl && !uploadedFile && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="p-4">
            <div
              {...getRootProps()}
              className={`
                cursor-pointer transition-colors duration-200 ease-in-out text-center py-4
                ${isDragActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {isDragActive ? "Solte para substituir" : "Clique ou arraste para substituir arquivo"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
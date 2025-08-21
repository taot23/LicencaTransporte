import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}

export function ImageUploader({ value, onChange, className }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string>(value || "");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar se é uma imagem
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecione apenas arquivos de imagem');
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Verificar se Object Storage está disponível
      const uploadConfigResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!uploadConfigResponse.ok) {
        throw new Error('Erro ao obter configuração de upload');
      }
      
      const { uploadURL, type } = await uploadConfigResponse.json();

      if (type === 'object_storage' && uploadURL) {
        // 2a. Upload via Object Storage (desenvolvimento)
        const putResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!putResponse.ok) {
          throw new Error('Erro ao fazer upload da imagem via Object Storage');
        }

        // Obter URL normalizada para Object Storage
        const normalizedUrl = `/objects/uploads/${uploadURL.split('/').pop()?.split('?')[0]}`;
        setPreview(normalizedUrl);
        onChange(normalizedUrl);
        
      } else {
        // 2b. Upload local (produção)
        const formData = new FormData();
        formData.append('image', file);

        const localUploadResponse = await fetch('/api/upload/vehicle-set-type-image', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!localUploadResponse.ok) {
          const errorData = await localUploadResponse.json();
          throw new Error(errorData.error || 'Erro ao fazer upload da imagem');
        }

        const { imageUrl } = await localUploadResponse.json();
        setPreview(imageUrl);
        onChange(imageUrl);
      }
      
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview("");
    onChange("");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Label>Imagem do Tipo de Conjunto</Label>
      
      <div className="flex items-center gap-4">
        {/* Preview da imagem */}
        {preview && (
          <div className="relative">
            <div className="w-32 h-20 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
              <img 
                src={preview} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain"
                onError={() => {
                  // Se a imagem falhar ao carregar, mostrar ícone
                  setPreview("");
                }}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Botão de upload */}
        <div className="flex-1">
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="image-upload"
          />
          <Label htmlFor="image-upload">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              className="cursor-pointer"
              asChild
            >
              <span>
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                    Fazendo upload...
                  </>
                ) : (
                  <>
                    {preview ? <ImageIcon className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {preview ? 'Alterar Imagem' : 'Selecionar Imagem'}
                  </>
                )}
              </span>
            </Button>
          </Label>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB. 
        <br />
        Recomendado: 300x200px para melhor visualização.
      </p>
    </div>
  );
}
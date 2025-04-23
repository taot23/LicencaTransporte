import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Vehicle } from "@shared/schema";
import { PlacaAdicionalItem } from './placa-adicional-item';
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { Check, Plus, Pencil } from 'lucide-react';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { VehicleFormModal } from "@/components/vehicles/vehicle-form-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CampoPlacaAdicionalProps {
  form: UseFormReturn<any>;
  vehicles: Vehicle[] | undefined;
  isLoadingVehicles: boolean;
  licenseType?: string;
}

// Validador para formato de placa
const isValidPlateFormat = (plate: string): boolean => {
  // Aceita formato Mercosul (AAA1A11) ou formato antigo (AAA1111)
  return /^[A-Z]{3}\d[A-Z0-9]\d\d$/.test(plate);
};

export function CampoPlacaAdicional({ form, vehicles, isLoadingVehicles, licenseType }: CampoPlacaAdicionalProps) {
  const [plateInput, setPlateInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [suggestedVehicles, setSuggestedVehicles] = useState<Vehicle[]>([]);
  const [openSuggestions, setOpenSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Estado para controlar o modal de veículo
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [plateToEdit, setPlateToEdit] = useState<string | undefined>();
  
  // Verificar se um veículo já está adicionado nas placas adicionais
  const isVehicleAlreadyInAdditionalPlates = (plate: string): boolean => {
    const additionalPlates = form.getValues('additionalPlates') || [];
    return additionalPlates.includes(plate);
  };
  
  // Verificar se um veículo está cadastrado
  const isPlateRegistered = (plate: string): boolean => {
    if (!vehicles) return false;
    return vehicles.some(v => v.plate === plate);
  };
  
  // Obter veículo pelo número da placa
  const getVehicleByPlate = (plate: string): Vehicle | undefined => {
    if (!vehicles) return undefined;
    return vehicles.find(v => v.plate === plate);
  };

  // Referência para os itens do comando para scroll
  const highlightedItemRef = useRef<HTMLDivElement | null>(null);
  
  // Efeito para scrollar para o item destacado
  useEffect(() => {
    if (highlightedItemRef.current) {
      highlightedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [highlightedIndex]);
  
  // Atualizar sugestões com base no input - sem interromper digitação
  useEffect(() => {
    if (!vehicles) return;
    
    // Normalizar o input para busca - sem remover caracteres para manter compatibilidade com digitação
    const normalized = plateInput.toUpperCase();
    
    if (normalized.length > 0) {
      // Filtrar veículos que correspondem ao padrão de busca
      // Utiliza .includes() para buscar parcial mesmo com vírgulas/espaços
      const filtered = vehicles.filter(v => 
        v.plate.toUpperCase().includes(normalized.replace(/[,\s]/g, ''))
      );
      
      // Ordenar em ordem alfabética pela placa
      const sortedVehicles = [...filtered].sort((a, b) => 
        a.plate.localeCompare(b.plate)
      );
      
      setSuggestedVehicles(sortedVehicles);
      
      // Mostrar sugestões quando há correspondências e input tem pelo menos 1 caractere
      if (sortedVehicles.length > 0 && plateInput.trim().length > 0) {
        setHighlightedIndex(0);
        setOpenSuggestions(true); // Abrir sugestões automaticamente
      } else {
        setOpenSuggestions(false);
      }
    } else {
      // Se o input estiver vazio, mostrar alguns veículos recentes
      // Mas também ordenados em ordem alfabética
      const initialVehicles = [...vehicles]
        .sort((a, b) => a.plate.localeCompare(b.plate))
        .slice(0, 5);
        
      setSuggestedVehicles(initialVehicles);
      
      // Mostrar sugestões iniciais mesmo com input vazio ao clicar
      if (document.activeElement === inputRef.current) {
        setOpenSuggestions(true);
      } else {
        setOpenSuggestions(false);
      }
    }
  }, [plateInput, vehicles]);
  
  // Processar entrada de múltiplas placas
  const processMultiplePlates = (input: string): string[] => {
    // Verificar se o input é de uma única placa
    if (isValidPlateFormat(input.toUpperCase().trim())) {
      return [input.toUpperCase().trim()];
    }
    
    // Dividir por vírgulas, espaços ou quebras de linha
    const parts = input.split(/[,\s\n]+/).filter(Boolean);
    
    // Normalizar e filtrar placas válidas
    const validPlates = parts
      .map(part => {
        const normalized = part.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
        return normalized;
      })
      .filter(plate => {
        const isValid = isValidPlateFormat(plate);
        return isValid;
      });
    
    // Remover duplicatas (compatível com ES5)
    const uniquePlates: string[] = [];
    validPlates.forEach(plate => {
      if (uniquePlates.indexOf(plate) === -1) {
        uniquePlates.push(plate);
      }
    });
    
    return uniquePlates;
  };
  
  // Adicionar uma única placa
  const addSinglePlate = (plate: string) => {
    // Verificar se a placa já foi adicionada
    if (isVehicleAlreadyInAdditionalPlates(plate)) {
      setInputError("Esta placa já foi adicionada");
      return false;
    }
    
    // Adicionar placa ao formulário
    const currentPlates = form.getValues('additionalPlates') || [];
    // Adicionar a nova placa e ordenar em ordem alfabética
    const newPlates = [...currentPlates, plate].sort((a: string, b: string) => a.localeCompare(b));
    
    form.setValue('additionalPlates', newPlates, {
      shouldValidate: true,
      shouldDirty: true
    });
    
    // Como as placas foram reordenadas, precisamos reordenar os documentos também
    // Criamos um mapa temporário para associar as placas originais aos seus documentos
    const currentDocs = form.getValues('additionalPlatesDocuments') || [];
    const docsMap = new Map<string, string>();
    
    // Mapear documentos existentes para suas placas
    currentPlates.forEach((existingPlate: string, index: number) => {
      docsMap.set(existingPlate, currentDocs[index] || '');
    });
    
    // Adicionar novo documento para a nova placa
    docsMap.set(plate, '');
    
    // Reconstruir a lista de documentos na mesma ordem das placas ordenadas
    const newDocs = newPlates.map((orderedPlate: string) => docsMap.get(orderedPlate) || '');
    
    form.setValue('additionalPlatesDocuments', newDocs);
    
    // Nota: Removemos a abertura automática do modal para placas não cadastradas
    // conforme solicitado pelo cliente
    
    return true;
  };
  
  // Manipular adição de placas
  const handleAddPlate = () => {
    // Se o input estiver vazio
    if (!plateInput.trim()) {
      setInputError("Digite uma placa");
      return;
    }
    
    // Processar múltiplas placas
    const platesToAdd = processMultiplePlates(plateInput);
    
    if (platesToAdd.length === 0) {
      setInputError("Nenhuma placa válida encontrada. Use o formato AAA1A11 ou AAA1111.");
      return;
    }
    
    // Adicionar cada placa válida
    let allAdded = true;
    let duplicateFound = false;
    
    for (const plate of platesToAdd) {
      const success = addSinglePlate(plate);
      if (!success) {
        duplicateFound = true;
        allAdded = false;
      }
    }
    
    // Feedback ao usuário
    if (duplicateFound) {
      setInputError("Algumas placas já estavam adicionadas");
    } else {
      setInputError(null);
    }
    
    // Limpar o campo de entrada
    setPlateInput("");
    setOpenSuggestions(false);
  };

  const handleRemovePlate = (index: number) => {
    // Remover a placa
    const plates = form.getValues('additionalPlates') || [];
    
    // Criar mapa de documentos associados a placas (exceto a que será removida)
    const docs = form.getValues('additionalPlatesDocuments') || [];
    const docsMap = new Map<string, string>();
    
    plates.forEach((plate: string, idx: number) => {
      if (idx !== index) { // Ignorar a placa que será removida
        docsMap.set(plate, docs[idx] || '');
      }
    });
    
    // Criar uma nova lista sem a placa removida (mas já mantendo a ordem alfabética)
    const newPlates = plates
      .filter((_: string, idx: number) => idx !== index)
      .sort((a: string, b: string) => a.localeCompare(b));
    
    // Definir as placas ordenadas
    form.setValue('additionalPlates', newPlates, {
      shouldValidate: true,
      shouldDirty: true
    });
    
    // Recriar a lista de documentos na mesma ordem das placas ordenadas
    const newDocs = newPlates.map((plate: string) => docsMap.get(plate) || '');
    form.setValue('additionalPlatesDocuments', newDocs);
  };

  // Função para adicionar veículo após criação/edição
  const handleVehicleSaved = (vehicle: Vehicle) => {
    // Se a placa já está na lista, não precisamos fazer nada
    if (isVehicleAlreadyInAdditionalPlates(vehicle.plate)) {
      return;
    }
    
    // Se a placa foi alterada durante a edição, vamos adicionar a nova placa
    if (plateToEdit !== vehicle.plate) {
      addSinglePlate(vehicle.plate);
    }
    
    // Fechar o modal
    setIsVehicleModalOpen(false);
    setPlateToEdit(undefined);
  };

  return (
    <FormField
      control={form.control}
      name="additionalPlates"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Placas Adicionais</FormLabel>
          <div className="space-y-4">
            {/* Modal de formulário de veículo */}
            <VehicleFormModal
              isOpen={isVehicleModalOpen}
              onClose={() => {
                setIsVehicleModalOpen(false);
                setPlateToEdit(undefined);
              }}
              plateToEdit={plateToEdit}
              onSuccess={handleVehicleSaved}
            />
            
            {/* Lista de placas adicionadas */}
            {field.value && field.value.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                {field.value.map((plate: string, index: number) => (
                  <PlacaAdicionalItem
                    key={`${plate}-${index}`}
                    plate={plate}
                    index={index}
                    vehicles={vehicles}
                    onRemove={handleRemovePlate}
                    onEdit={(plate) => {
                      // Abrir modal para edição/cadastro de veículo
                      setPlateToEdit(plate);
                      setIsVehicleModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
            
            {/* Campo para adicionar placa - VERSÃO SIMPLIFICADA SEM POPOVER */}
            <div className="flex items-start gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={plateInput}
                  maxLength={80} // Aumentamos para permitir múltiplas placas
                  onChange={(e) => {
                    // Converter para maiúsculas e continuar digitação
                    setPlateInput(e.target.value.toUpperCase());
                    setInputError(null);
                    
                    // Verificar se o último caractere é uma vírgula ou espaço
                    const lastChar = e.target.value.slice(-1);
                    const isLastCharDelimiter = /[,\s]/.test(lastChar);
                    const isTextComplete = e.target.value.length >= 7;
                    
                    // Se terminar com vírgula ou espaço, e tiver pelo menos 7 caracteres 
                    // (tamanho mínimo da placa), processar múltiplas placas
                    if (isLastCharDelimiter && isTextComplete) {
                      // Verificar se há placas válidas antes do delimitador
                      const platesSoFar = processMultiplePlates(e.target.value);
                      
                      if (platesSoFar.length > 0) {
                        // Adicionar placas válidas
                        platesSoFar.forEach((plate: string) => {
                          addSinglePlate(plate);
                        });
                        
                        // Limpar o campo após adicionar as placas
                        setTimeout(() => {
                          setPlateInput("");
                        }, 50);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPlate();
                    }
                  }}
                  placeholder="Digite placas (separadas por vírgula, espaço ou enter)"
                  className="w-full"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Limite máximo de 80 caracteres por vez. Para adicionar mais placas, clique em Adicionar e continue.
                </p>
                {inputError && (
                  <p className="text-sm text-red-500 mt-1">{inputError}</p>
                )}
              </div>
              <Button 
                type="button" 
                onClick={handleAddPlate}
                className="mt-0"
              >
                Adicionar
              </Button>
            </div>
            
            {/* Lista de sugestões */}
            {openSuggestions && suggestedVehicles.length > 0 && (
              <div className="relative w-full z-10">
                <div className="absolute top-0 left-0 w-full border border-gray-200 rounded-md shadow-md bg-white">
                  <Command className="rounded-lg">
                    <CommandList className="max-h-[200px] overflow-y-auto">
                      <CommandGroup heading="Veículos cadastrados">
                        {suggestedVehicles.map((vehicle, index) => (
                          <CommandItem
                            key={vehicle.id}
                            onSelect={() => {
                              addSinglePlate(vehicle.plate);
                              setPlateInput("");
                              setOpenSuggestions(false);
                            }}
                            className={`flex items-center justify-between py-3 ${
                              index === highlightedIndex ? "bg-muted" : ""
                            }`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                          >
                            <div 
                              className="flex flex-col"
                              ref={index === highlightedIndex ? highlightedItemRef : null}
                            >
                              <span className={`font-medium text-base ${
                                index === highlightedIndex ? "text-primary" : ""
                              }`}>{vehicle.plate}</span>
                              <span className="text-xs text-muted-foreground mt-1">
                                {vehicle.brand} {vehicle.model} - {
                                  vehicle.type === "semi_trailer" ? "Semirreboque" :
                                  vehicle.type === "dolly" ? "Dolly" :
                                  vehicle.type === "flatbed" ? "Prancha" : 
                                  vehicle.type
                                }
                              </span>
                            </div>
                            <Check 
                              className={`h-5 w-5 text-primary ${
                                index === highlightedIndex ? "opacity-100" : "opacity-0"
                              }`}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              </div>
            )}
            
            {/* Dicas e legenda */}
            <div className="space-y-3 text-xs text-gray-500 border-t pt-3 mt-3">
              <div>
                <p className="font-medium mb-1">Como adicionar placas:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Digite placas separadas por vírgula, espaço ou enter</li>
                  <li>Clique em uma sugestão para adicionar</li>
                </ul>
              </div>
              
              <div>
                <p className="font-medium mb-1">Legenda:</p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                      <span>ABC1D23</span>
                      <Pencil className="h-3 w-3" />
                    </div>
                    <span>Placa cadastrada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-red-100 text-red-800 px-2 py-1 rounded flex items-center gap-1">
                      <span>XYZ9W87</span>
                      <Plus className="h-3 w-3" />
                    </div>
                    <span>Placa não cadastrada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
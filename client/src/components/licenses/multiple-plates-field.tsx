import React, { useEffect, useState, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { LicensePlateButtons } from '@/components/ui/license-plate-buttons';

interface MultiplePlatesFieldProps {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
}

interface Vehicle {
  id: number;
  plate: string;
  type: string;
}

// Função para validar o formato da placa
const isValidLicensePlate = (plate: string): boolean => {
  // Validar formato Mercosul (AAA1A11) ou formato antigo (AAA1111)
  return /^[A-Z]{3}\d[A-Z0-9]\d\d$/.test(plate);
};

// Função para formatar a placa (tudo em maiúsculo)
const formatLicensePlate = (plate: string): string => {
  return plate.toUpperCase().trim();
};

export function MultiplePlatesField({
  name,
  label,
  description,
  required = false,
}: MultiplePlatesFieldProps) {
  const { control, setValue, getValues } = useFormContext();
  const [vehiclePlates, setVehiclePlates] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Efeito para adicionar e remover a classe ao body quando o input está com foco
  useEffect(() => {
    const handleFocus = () => {
      document.body.classList.add('keyboard-active');
    };
    
    const handleBlur = () => {
      document.body.classList.remove('keyboard-active');
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    }
    
    return () => {
      if (input) {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      }
      // Garantir que a classe seja removida quando o componente for desmontado
      document.body.classList.remove('keyboard-active');
    };
  }, []);
  
  // Buscar sugestões de placas usando a nova rota pública
  const { data: plateSuggestions = [], isLoading, isError } = useQuery<string[]>({
    queryKey: ['/api/public/vehicle-plates'],
    refetchOnMount: true,
    staleTime: 30000, // Considerar dados frescos por 30 segundos
    refetchOnWindowFocus: true
  });
  
  // Buscar veículos para validação - usando API pública para garantir acesso
  const { data: vehicles = [], isSuccess: vehiclesLoaded } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/vehicles', {
          method: 'GET',
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error('Erro ao buscar veículos:', response.status);
          return [];
        }
        
        const result = await response.json();
        console.log("Veículos carregados da API:", result);
        return result;
      } catch (error) {
        console.error('Erro ao buscar veículos:', error);
        return [];
      }
    },
    refetchOnMount: true,
    staleTime: 30000
  });
  
  // Função para verificar se a placa pertence a um veículo cadastrado
  const isRegisteredVehicle = (plate: string): boolean => {
    if (!plate || !vehicles) {
      return false;
    }
    
    // Importante: Garantir que temos um array de veículos para verificar
    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      console.log(`Nenhum veículo cadastrado para verificar placa ${plate}`);
      return false;
    }
    
    // Normaliza a placa para evitar problemas de formatação
    const normalizedPlate = plate.toUpperCase().trim();
    
    // Mapeando todas as placas cadastradas para comparação
    const result = vehicles.some(vehicle => 
      vehicle.plate.toUpperCase().trim() === normalizedPlate
    );
    
    // Log de debug com informações detalhadas
    console.log(`Verificando placa ${plate} (normalizada: ${normalizedPlate})`);
    console.log(`Resultado: ${result ? 'REGISTRADA ✓' : 'NÃO REGISTRADA ✗'}`);
    console.log(`Total de veículos cadastrados: ${vehicles.length}`);
    
    return result;
  };
  
  // Logar as sugestões de placas para debug
  useEffect(() => {
    console.log("Sugestões de placas recebidas:", plateSuggestions);
    console.log("Número total de sugestões:", plateSuggestions.length);
    
    if (isError) {
      console.error("Erro ao carregar sugestões de placas");
    } else if (isLoading) {
      console.log("Carregando sugestões de placas...");
    } else if (plateSuggestions.length === 0) {
      console.warn("Nenhuma sugestão de placa disponível");
    }
  }, [plateSuggestions, isError, isLoading]);
  
  // Logar os veículos carregados
  useEffect(() => {
    console.log("Veículos carregados:", vehicles);
    console.log("Total de veículos:", vehicles.length);
    if (vehicles.length > 0) {
      console.log("Placas dos veículos:", vehicles.map(v => v.plate));
    }
  }, [vehicles]);
  
  // Inicializar o valor do campo se já houver placas salvas
  useEffect(() => {
    const currentValue = getValues(name);
    if (currentValue && Array.isArray(currentValue) && currentValue.length > 0) {
      setVehiclePlates(currentValue);
    }
  }, [getValues, name]);
  
  // Atualizar o valor do formulário quando as placas mudarem
  useEffect(() => {
    setValue(name, vehiclePlates, { shouldValidate: true, shouldDirty: true });
  }, [vehiclePlates, setValue, name]);

  // Manipular adição de nova placa
  const handleAddPlate = () => {
    if (!inputValue) return;
    
    const formatted = formatLicensePlate(inputValue);
    
    if (!isValidLicensePlate(formatted)) {
      setError('Formato de placa inválido. Use AAA1A11 ou AAA1111.');
      return;
    }
    
    if (vehiclePlates.includes(formatted)) {
      setError('Esta placa já foi adicionada.');
      return;
    }
    
    // Se a placa não está nas sugestões, verificamos se é de um veículo cadastrado
    if (!plateSuggestions.includes(formatted) && !isRegisteredVehicle(formatted)) {
      // Adicionamos mesmo assim, mas alertamos o usuário
      console.warn(`Placa ${formatted} não encontrada entre os veículos cadastrados.`);
    }
    
    setVehiclePlates([...vehiclePlates, formatted]);
    setInputValue('');
    setError('');
  };

  // Alternar a seleção da placa (adicionar ou remover)
  const togglePlateSelection = (plate: string) => {
    if (vehiclePlates.includes(plate)) {
      setVehiclePlates(vehiclePlates.filter(p => p !== plate));
    } else {
      setVehiclePlates([...vehiclePlates, plate]);
    }
  };

  // Lidar com a pressão da tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPlate();
    }
  };

  return (
    <FormItem>
      <FormLabel>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </FormLabel>
      
      {/* Campo de entrada com botão de adicionar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <FormControl className="w-full">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma placa (ex: AAA1234)"
            maxLength={7}
            autoComplete="off"
            className="mobile-input-plate h-10"
            // Ajuste para dispositivos móveis - usar teclado específico
            inputMode="text"
            pattern="[A-Za-z0-9]*"
            id="license-plate-input"
            onFocus={() => {
              // Rolar a página para cima quando o input receber foco
              window.scrollTo(0, 0);
              // Adicionar pequeno atraso para garantir que o teclado apareça antes de reposicionar
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 300);
            }}
          />
        </FormControl>
        <Button 
          type="button" 
          size="sm" 
          onClick={handleAddPlate}
          className="whitespace-nowrap sm:w-auto w-full h-10"
        >
          Adicionar
        </Button>
      </div>
      
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      
      {/* Exibir placas disponíveis como botões */}
      {plateSuggestions.length > 0 && (
        <div className="mt-4 border p-3 rounded-md bg-gray-50">
          <p className="text-sm font-medium mb-2">Placas disponíveis ({plateSuggestions.length}):</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {plateSuggestions.map((plate) => {
              // Verifica se a placa é de um veículo cadastrado
              // Forçar o recálculo toda vez que este componente renderizar
              const isRegistered = isRegisteredVehicle(plate);
              console.log(`Renderizando placa ${plate}, registrado: ${isRegistered}`);
              
              return (
                <Button
                  key={plate}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`px-2 py-0.5 h-7 text-xs font-medium 
                    ${vehiclesLoaded ? (
                      vehiclePlates.includes(plate)
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-white border-cyan-500' // Placa selecionada (sempre azul)
                        : isRegistered
                          ? 'bg-green-500 hover:bg-green-400 text-white border-green-500' // Veículo cadastrado (verde)
                          : 'bg-red-500 hover:bg-red-400 text-white border-red-500' // Veículo não cadastrado (vermelho)
                      ) : 'bg-gray-500 hover:bg-gray-400 text-white' // Estado de carregamento
                    }
                  `}
                  onClick={() => togglePlateSelection(plate)}
                >
                  {plate}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Exibir placas selecionadas */}
      {vehiclePlates.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Placas selecionadas:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {vehiclePlates.map((plate) => {
              // Verifica se a placa é de um veículo cadastrado
              // Forçar o recálculo toda vez que este componente renderizar
              const isRegistered = isRegisteredVehicle(plate);
              console.log(`Renderizando placa selecionada ${plate}, registrado: ${isRegistered}`);
              
              return (
                <Button
                  key={plate}
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`px-2 py-0.5 h-7 text-xs font-medium 
                    ${vehiclesLoaded ? (
                      isRegistered
                        ? 'bg-green-600 hover:bg-green-500 text-white border-green-600' // Veículo cadastrado (verde)
                        : 'bg-red-600 hover:bg-red-500 text-white border-red-600' // Veículo não cadastrado (vermelho)
                      ) : 'bg-gray-500 hover:bg-gray-400 text-white' // Estado de carregamento
                    } flex justify-between`}
                  onClick={() => {}}
                >
                  <span className="truncate mr-1">{plate}</span>
                  <X
                    className="w-3 h-3 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlateSelection(plate);
                    }}
                  />
                </Button>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Legenda explicativa das cores */}
      <div className="mt-4 flex flex-col gap-1">
        <p className="text-xs font-medium">Legenda:</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-600"></div>
            <span>Veículo cadastrado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-600"></div>
            <span>Veículo não cadastrado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-cyan-500"></div>
            <span>Placa selecionada</span>
          </div>
        </div>
      </div>
      
      {description ? (
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      ) : (
        <p className="text-sm text-muted-foreground mt-2">
          Clique nas placas acima para selecionar veículos ou adicione manualmente
        </p>
      )}
      <FormMessage />
    </FormItem>
  );
}
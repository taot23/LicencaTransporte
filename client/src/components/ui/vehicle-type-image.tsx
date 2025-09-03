import { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VehicleSetType } from '@shared/vehicle-set-types';

// Importando as imagens dos tipos de veículos
import bitrain6AxlesImg from '../../assets/vehicles/bitrain_6_axles.png';
import bitrain7AxlesImg from '../../assets/vehicles/bitrain_7_axles.png';
import bitrain9AxlesImg from '../../assets/vehicles/bitrain_9_axles.png';
import roadtrain9AxlesImg from '../../assets/vehicles/roadtrain_9_axles.png';
import flatbedImg from '../../assets/vehicles/flatbed.png';
import romeoAndJulietImg from '../../assets/vehicles/romeo_and_juliet.png';

// Importando os novos ícones personalizados
import genericTruckIcon from '@assets/{F9464883-3F10-4933-AF74-76A8D67A0F59}_1756866800903.png';
import containerTruckIcon from '@assets/caminhao-conteiner_1756866832654.png';

interface VehicleTypeImageProps {
  type: string;
  className?: string;
  iconSize?: number;
}

export const VehicleTypeImage: FC<VehicleTypeImageProps> = ({ 
  type, 
  className = "",
  iconSize = 20
}) => {
  // Buscar tipos personalizados da API
  const { data: vehicleSetTypes = [] } = useQuery<VehicleSetType[]>({
    queryKey: ['/api/admin/vehicle-set-types'],
    staleTime: 2 * 60 * 1000, // 2 minutos de cache
  });

  // Verificar se é um tipo personalizado com imagem
  const customType = vehicleSetTypes.find(vst => vst.name === type);
  if (customType && customType.imageUrl) {
    return (
      <img 
        src={customType.imageUrl} 
        alt={customType.label} 
        className={`w-auto ${className}`}
        style={{ 
          height: `${iconSize}px`,
          objectFit: 'contain',
          objectPosition: 'center'
        }}
      />
    );
  }

  // Verificar o tipo de veículo e retornar a imagem apropriada (tipos padrão)
  switch (type) {
    case 'bitrain_6_axles':
      return (
        <img 
          src={bitrain6AxlesImg} 
          alt="Bitrem 6 eixos" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
    case 'bitrain_9_axles':
      return (
        <img 
          src={bitrain9AxlesImg} 
          alt="Bitrem 9 eixos" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
    case 'bitrain_7_axles':
      return (
        <img 
          src={bitrain7AxlesImg} 
          alt="Bitrem 7 eixos" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
    case 'roadtrain_9_axles':
      return (
        <img 
          src={roadtrain9AxlesImg} 
          alt="Rodotrem 9 eixos" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
    case 'flatbed':
      return (
        <img 
          src={containerTruckIcon} 
          alt="Prancha" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
    case 'romeo_and_juliet':
      return (
        <img 
          src={romeoAndJulietImg} 
          alt="Romeu e Julieta" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
    // Adicionar mais cases para outros tipos conforme necessário
    
    default:
      // Para tipos sem imagem específica, usar o novo ícone personalizado
      return (
        <img 
          src={genericTruckIcon} 
          alt="Veículo genérico" 
          className={`w-auto ${className}`}
          style={{ 
            height: `${iconSize}px`,
            objectFit: 'contain',
            objectPosition: 'center'
          }}
        />
      );
  }
};
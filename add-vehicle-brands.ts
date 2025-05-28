// Script para adicionar marcas e modelos de veículos no banco de dados
import { db, pool } from './server/db';
import { vehicleModels } from './shared/schema';

async function addVehicleBrands() {
  try {
    console.log('Iniciando adição de marcas e modelos de veículos...');

    // Dados das marcas e modelos de veículos
    const vehicleData = [
      { brand: 'DAF', model: 'CF FT 410', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'CF85 FT 410A', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FT 480', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FT 480 SSC', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FT 530', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FTS 480', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FTS 530 SSC', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FTT 480', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FTT 530', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF FTT 530 SSC', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF105 FTS 460A', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF105 FTT 460A', vehicleType: 'tractor_unit' },
      { brand: 'DAF', model: 'XF105 FTT 510A', vehicleType: 'tractor_unit' },
      
      { brand: 'FORD', model: 'CARGO 1621', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 1622', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2042 AT', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2425', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2428 CNL', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2428 E', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2428E', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2429L', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2431 l', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2629 6X4', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2842 AT', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 2932 E', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 4331', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 4532 E', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 4532E TOPLINE', vehicleType: 'truck' },
      { brand: 'FORD', model: 'CARGO 6332E', vehicleType: 'truck' },
      { brand: 'FORD', model: 'F14000', vehicleType: 'truck' },

      { brand: 'IVECO', model: 'EUROTECH 450E37TN1', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'CAVALLINO 450E32T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'CURSOR 450E32T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'CURSOR 450E33T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'STRALIS 450S33T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'STRALIS 460S36T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'STRALIS 490S38T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'STRALIS 490S40T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'STRALIS 490S41T', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'S-WAY 480-4X2', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'S-WAY 480-6X2', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'S-WAY 540-6X4', vehicleType: 'tractor_unit' },
      { brand: 'IVECO', model: 'TECTOR 240E28', vehicleType: 'truck' },
      { brand: 'IVECO', model: 'TRACTOR 310E30CE', vehicleType: 'truck' },

      { brand: 'MERCEDES-BENZ', model: 'ACTROS 2045S', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'ACTROS 2651LS6X4', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'ACTROS 2651S6X4', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'ACTROS 2646LS6X4', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 1933 S', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 2040 S', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 2041 LS', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 2535 S', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 2544 S', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 2644 LS 6X4', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 2644S6X4', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'AXOR 3344S6X4', vehicleType: 'tractor_unit' },
      { brand: 'MERCEDES-BENZ', model: 'ATEGO 1726', vehicleType: 'truck' },
      { brand: 'MERCEDES-BENZ', model: 'ATEGO 1726 CE', vehicleType: 'truck' },
      { brand: 'MERCEDES-BENZ', model: 'ATEGO 2426', vehicleType: 'truck' },
      { brand: 'MERCEDES-BENZ', model: 'ATEGO 2428', vehicleType: 'truck' },
      { brand: 'MERCEDES-BENZ', model: 'ATEGO 2425', vehicleType: 'truck' },
      { brand: 'MERCEDES-BENZ', model: 'ATEGO 2730 CE', vehicleType: 'truck' },

      { brand: 'MAN', model: 'TGX 28.440 6X2 T', vehicleType: 'tractor_unit' },
      { brand: 'MAN', model: 'TGX 29.440 6X4 T', vehicleType: 'tractor_unit' },
      { brand: 'MAN', model: 'TGX 29.480 6X4 T', vehicleType: 'tractor_unit' },
      { brand: 'MAN', model: 'TGX 33.440 6X4 T', vehicleType: 'tractor_unit' },

      { brand: 'SCANIA', model: 'G 360 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 380 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 380 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 400 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 400 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 420 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 420 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 420 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 440 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 470 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'G 480 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 380 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 400 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 410 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 420 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 420 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 420 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 440 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 440 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 440 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 460 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 470 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 470 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 480 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 500 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 560 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'R 620 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'S450 A4X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'S450 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'S460 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'S500 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'S540 A6X4', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'S560 A6X2', vehicleType: 'tractor_unit' },
      { brand: 'SCANIA', model: 'P 250 B6X2', vehicleType: 'truck' },
      { brand: 'SCANIA', model: 'P 250 B6X4', vehicleType: 'truck' },
      { brand: 'SCANIA', model: 'P 270 B6X2', vehicleType: 'truck' },
      { brand: 'SCANIA', model: 'P 310 B6X2', vehicleType: 'truck' },
      { brand: 'SCANIA', model: 'P 310 B6X4', vehicleType: 'truck' },

      { brand: 'VOLVO', model: 'FH 400 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 400 6X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 400 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 420 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 440 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 440 6X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 440 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 460 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 460 6X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 460 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 480 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 480 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 500 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 500 6X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 500 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 520 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH 540 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 380 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 380 6X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 380 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 420 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 420 6X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 420 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 460 4X2T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FH12 460 6X4T', vehicleType: 'tractor_unit' },
      { brand: 'VOLVO', model: 'FM 370 4X2T', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'FM 370 6X2T', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'FM 440 6X4T', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'FM 480 6X4T', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'VM 260 6X2R', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'VM 290 6X4 R', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'VM 310 4X2T', vehicleType: 'truck' },
      { brand: 'VOLVO', model: 'VM 310 6X4R', vehicleType: 'truck' },

      { brand: 'VOLKSWAGEN', model: '18.310 TITAN', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '19.320 CLC TT', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '19.330 CTC 4X2', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '19.360 CTC 4X2', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '24.330 CRC 6X2', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '25.370 CNM T 6X2', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '25.390 CTC 6X2', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '25.420 CTC 6X2', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '26.390 CTC 6X4', vehicleType: 'truck' },
      { brand: 'VOLKSWAGEN', model: '29.520 METEOR 6X4', vehicleType: 'tractor_unit' },
      { brand: 'VOLKSWAGEN', model: '31.330 CRC 6X4', vehicleType: 'tractor_unit' },
      { brand: 'VOLKSWAGEN', model: '33.460 CTM 6X4', vehicleType: 'tractor_unit' },

      // Semirreboques e implementos
      { brand: 'RANDON', model: 'SR BA', vehicleType: 'semi_trailer' },
      { brand: 'RANDON', model: 'SR GRANELEIRO', vehicleType: 'semi_trailer' },
      { brand: 'RANDON', model: 'SR CARGA SECA', vehicleType: 'semi_trailer' },
      { brand: 'RANDON', model: 'SR TANQUE', vehicleType: 'semi_trailer' },
      { brand: 'LIBRELATO', model: 'SR GRANELEIRO', vehicleType: 'semi_trailer' },
      { brand: 'LIBRELATO', model: 'SR CARGA SECA', vehicleType: 'semi_trailer' },
      { brand: 'LIBRELATO', model: 'SR BAU', vehicleType: 'semi_trailer' },
      { brand: 'GUERRA', model: 'SR GRANELEIRO', vehicleType: 'semi_trailer' },
      { brand: 'GUERRA', model: 'SR CARGA SECA', vehicleType: 'semi_trailer' },
      { brand: 'NOMA', model: 'SR GRANELEIRO', vehicleType: 'semi_trailer' },
      { brand: 'NOMA', model: 'SR CARGA SECA', vehicleType: 'semi_trailer' },
      { brand: 'FACCHINI', model: 'SR GRANELEIRO', vehicleType: 'semi_trailer' },
      { brand: 'FACCHINI', model: 'SR CARGA SECA', vehicleType: 'semi_trailer' },
      { brand: 'BITREM', model: 'GRANELEIRO 7+7', vehicleType: 'trailer' },
      { brand: 'BITREM', model: 'CARGA SECA 7+7', vehicleType: 'trailer' },

      // Reboques
      { brand: 'RANDON', model: 'RB GRANELEIRO', vehicleType: 'trailer' },
      { brand: 'RANDON', model: 'RB CARGA SECA', vehicleType: 'trailer' },
      { brand: 'LIBRELATO', model: 'RB GRANELEIRO', vehicleType: 'trailer' },
      { brand: 'LIBRELATO', model: 'RB CARGA SECA', vehicleType: 'trailer' },

      // Dollies
      { brand: 'RANDON', model: 'DOLLY RODOVIARIO', vehicleType: 'dolly' },
      { brand: 'LIBRELATO', model: 'DOLLY RODOVIARIO', vehicleType: 'dolly' },
      { brand: 'GUERRA', model: 'DOLLY RODOVIARIO', vehicleType: 'dolly' },

      // Pranchas
      { brand: 'RANDON', model: 'PRANCHA 3 EIXOS', vehicleType: 'flatbed' },
      { brand: 'RANDON', model: 'PRANCHA 4 EIXOS', vehicleType: 'flatbed' },
      { brand: 'LIBRELATO', model: 'PRANCHA 3 EIXOS', vehicleType: 'flatbed' },
      { brand: 'LIBRELATO', model: 'PRANCHA 4 EIXOS', vehicleType: 'flatbed' },
      { brand: 'GUERRA', model: 'PRANCHA 3 EIXOS', vehicleType: 'flatbed' },
      { brand: 'GUERRA', model: 'PRANCHA 4 EIXOS', vehicleType: 'flatbed' }
    ];

    console.log(`Adicionando ${vehicleData.length} marcas e modelos de veículos...`);

    // Inserir todas as marcas e modelos
    for (const vehicle of vehicleData) {
      try {
        await db.insert(vehicleModels).values({
          brand: vehicle.brand,
          model: vehicle.model,
          vehicleType: vehicle.vehicleType
        });
        console.log(`✓ ${vehicle.brand} ${vehicle.model} (${vehicle.vehicleType})`);
      } catch (error: any) {
        if (error.message?.includes('duplicate')) {
          console.log(`⚠ Já existe: ${vehicle.brand} ${vehicle.model}`);
        } else {
          console.error(`✗ Erro ao adicionar ${vehicle.brand} ${vehicle.model}:`, error.message);
        }
      }
    }

    console.log('✅ Todas as marcas e modelos foram processados com sucesso!');
    console.log(`📊 Total de registros processados: ${vehicleData.length}`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao adicionar marcas e modelos:', error);
    await pool.end();
    process.exit(1);
  }
}

addVehicleBrands();
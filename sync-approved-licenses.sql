-- Script SQL para sincronizar licenças aprovadas existentes para a tabela licencas_emitidas
-- Execute este script no seu servidor de produção

-- 1. Primeiro, garantir que a tabela licencas_emitidas existe com a estrutura correta
CREATE TABLE IF NOT EXISTS licencas_emitidas (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    estado VARCHAR(10) NOT NULL,
    numero_licenca VARCHAR(100) NOT NULL,
    data_emissao TIMESTAMP NOT NULL,
    data_validade TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'ativa',
    placa_unidade_tratora VARCHAR(20),
    placa_primeira_carreta VARCHAR(20),
    placa_segunda_carreta VARCHAR(20),
    placa_dolly VARCHAR(20),
    placa_prancha VARCHAR(20),
    placa_reboque VARCHAR(20),
    cnpj_selecionado VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pedido_estado UNIQUE (pedido_id, estado)
);

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_licencas_emitidas_status ON licencas_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_licencas_emitidas_estado ON licencas_emitidas(estado);
CREATE INDEX IF NOT EXISTS idx_licencas_emitidas_placas ON licencas_emitidas(placa_unidade_tratora, placa_primeira_carreta, placa_segunda_carreta);
CREATE INDEX IF NOT EXISTS idx_licencas_emitidas_validade ON licencas_emitidas(data_validade);

-- 3. Função para extrair dados do array state_statuses
CREATE OR REPLACE FUNCTION extract_state_data(state_statuses TEXT[], estado_busca TEXT)
RETURNS TABLE(estado TEXT, status TEXT, data_validade TEXT, data_emissao TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        split_part(unnest_val, ':', 1) as estado,
        split_part(unnest_val, ':', 2) as status,
        split_part(unnest_val, ':', 3) as data_validade,
        split_part(unnest_val, ':', 4) as data_emissao
    FROM unnest(state_statuses) as unnest_val
    WHERE split_part(unnest_val, ':', 1) = estado_busca
      AND split_part(unnest_val, ':', 2) = 'approved';
END;
$$ LANGUAGE plpgsql;

-- 4. Função para extrair número AET
CREATE OR REPLACE FUNCTION extract_aet_number(state_aet_numbers TEXT[], estado_busca TEXT, pedido_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    aet_number TEXT;
BEGIN
    -- Tentar encontrar o número AET no array
    SELECT split_part(unnest_val, ':', 2)
    INTO aet_number
    FROM unnest(COALESCE(state_aet_numbers, ARRAY[]::TEXT[])) as unnest_val
    WHERE split_part(unnest_val, ':', 1) = estado_busca
    LIMIT 1;
    
    -- Se não encontrou, usar formato padrão
    IF aet_number IS NULL OR aet_number = '' THEN
        aet_number := estado_busca || '-' || pedido_id;
    END IF;
    
    RETURN aet_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para extrair CNPJ selecionado
CREATE OR REPLACE FUNCTION extract_cnpj(state_cnpjs TEXT[], estado_busca TEXT)
RETURNS TEXT AS $$
DECLARE
    cnpj_selected TEXT;
BEGIN
    SELECT split_part(unnest_val, ':', 2)
    INTO cnpj_selected
    FROM unnest(COALESCE(state_cnpjs, ARRAY[]::TEXT[])) as unnest_val
    WHERE split_part(unnest_val, ':', 1) = estado_busca
    LIMIT 1;
    
    RETURN cnpj_selected;
END;
$$ LANGUAGE plpgsql;

-- 6. Script principal de sincronização
DO $$
DECLARE
    license_record RECORD;
    state_data RECORD;
    aet_number TEXT;
    cnpj_selected TEXT;
    placa_primeira TEXT;
    placa_segunda TEXT;
    contador INTEGER := 0;
    total_estados INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Iniciando sincronização de licenças aprovadas...';
    
    -- Iterar por todas as licenças com estados aprovados
    FOR license_record IN
        SELECT 
            id, user_id, transporter_id, request_number, type, main_vehicle_plate,
            tractor_unit_id, first_trailer_id, second_trailer_id,
            state_statuses, state_aet_numbers, state_cnpjs,
            created_at, updated_at
        FROM license_requests 
        WHERE state_statuses IS NOT NULL 
          AND array_to_string(state_statuses, ',') LIKE '%:approved:%'
        ORDER BY id
    LOOP
        contador := contador + 1;
        RAISE NOTICE '📋 Processando licença % (ID: %)', license_record.request_number, license_record.id;
        
        -- Processar cada estado aprovado nesta licença
        FOR state_data IN
            SELECT * FROM extract_state_data(license_record.state_statuses, unnest_estado)
            FROM unnest(ARRAY(
                SELECT DISTINCT split_part(unnest_val, ':', 1)
                FROM unnest(license_record.state_statuses) as unnest_val
                WHERE split_part(unnest_val, ':', 2) = 'approved'
            )) as unnest_estado
        LOOP
            -- Extrair número AET
            aet_number := extract_aet_number(license_record.state_aet_numbers, state_data.estado, license_record.id);
            
            -- Extrair CNPJ selecionado
            cnpj_selected := extract_cnpj(license_record.state_cnpjs, state_data.estado);
            
            -- Buscar placas dos veículos
            placa_primeira := NULL;
            placa_segunda := NULL;
            
            IF license_record.first_trailer_id IS NOT NULL THEN
                SELECT plate INTO placa_primeira 
                FROM vehicles 
                WHERE id = license_record.first_trailer_id;
            END IF;
            
            IF license_record.second_trailer_id IS NOT NULL THEN
                SELECT plate INTO placa_segunda 
                FROM vehicles 
                WHERE id = license_record.second_trailer_id;
            END IF;
            
            -- Inserir na tabela licencas_emitidas
            BEGIN
                INSERT INTO licencas_emitidas (
                    pedido_id, estado, numero_licenca, data_emissao, data_validade, status,
                    placa_unidade_tratora, placa_primeira_carreta, placa_segunda_carreta,
                    cnpj_selecionado, created_at, updated_at
                ) VALUES (
                    license_record.id, state_data.estado, aet_number, 
                    state_data.data_emissao::timestamp, state_data.data_validade::timestamp, 'ativa',
                    license_record.main_vehicle_plate, placa_primeira, placa_segunda,
                    cnpj_selected, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (pedido_id, estado) 
                DO UPDATE SET
                    numero_licenca = EXCLUDED.numero_licenca,
                    data_validade = EXCLUDED.data_validade,
                    data_emissao = EXCLUDED.data_emissao,
                    status = 'ativa',
                    placa_unidade_tratora = EXCLUDED.placa_unidade_tratora,
                    placa_primeira_carreta = EXCLUDED.placa_primeira_carreta,
                    placa_segunda_carreta = EXCLUDED.placa_segunda_carreta,
                    cnpj_selecionado = EXCLUDED.cnpj_selecionado,
                    updated_at = CURRENT_TIMESTAMP;
                
                total_estados := total_estados + 1;
                RAISE NOTICE '  ✅ %: % (válida até %)', state_data.estado, aet_number, state_data.data_validade;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '  ❌ Erro ao sincronizar %: %', state_data.estado, SQLERRM;
            END;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '🎉 Sincronização concluída!';
    RAISE NOTICE '📊 Estatísticas:';
    RAISE NOTICE '   - Licenças processadas: %', contador;
    RAISE NOTICE '   - Estados sincronizados: %', total_estados;
    RAISE NOTICE '   - Total de licenças ativas na tabela: %', (SELECT COUNT(*) FROM licencas_emitidas WHERE status = 'ativa');
END $$;

-- 7. Remover funções auxiliares
DROP FUNCTION IF EXISTS extract_state_data(TEXT[], TEXT);
DROP FUNCTION IF EXISTS extract_aet_number(TEXT[], TEXT, INTEGER);
DROP FUNCTION IF EXISTS extract_cnpj(TEXT[], TEXT);

-- 8. Verificar resultado final
SELECT 
    COUNT(*) as total_licencas_ativas,
    COUNT(DISTINCT estado) as estados_distintos,
    COUNT(DISTINCT pedido_id) as licencas_distintas
FROM licencas_emitidas 
WHERE status = 'ativa';

-- 9. Mostrar resumo por estado
SELECT 
    estado,
    COUNT(*) as quantidade,
    MIN(data_validade) as primeira_validade,
    MAX(data_validade) as ultima_validade
FROM licencas_emitidas 
WHERE status = 'ativa'
GROUP BY estado 
ORDER BY estado;
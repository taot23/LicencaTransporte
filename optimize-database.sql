-- Script de otimização crítica para grandes volumes de dados
-- Sistema AET - Performance para 40.000+ placas e 10.000+ transportadores

-- ÍNDICES CRÍTICOS PARA PERFORMANCE

-- 1. Índices para busca de veículos por placa (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_plate_upper ON vehicles (UPPER(plate));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_type ON vehicles (type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_user_id ON vehicles (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_status ON vehicles (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_brand_model ON vehicles (UPPER(brand), UPPER(model));

-- 2. Índices para busca de transportadores (case-insensitive) 
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transporters_name_upper ON transporters (UPPER(name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transporters_document ON transporters (document_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transporters_trade_name ON transporters (UPPER(trade_name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transporters_city_state ON transporters (UPPER(city), UPPER(state));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transporters_phone ON transporters (phone);

-- 3. Índices para licenças (performance em validações)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_requests_main_plate ON license_requests (UPPER(main_vehicle_plate));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_requests_status ON license_requests (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_requests_transporter ON license_requests (transporter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_requests_user ON license_requests (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_requests_created ON license_requests (created_at DESC);

-- 4. Índice composto para validação por combinação de veículos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_combo_validation ON license_requests 
(status, tractor_unit_id, first_trailer_id, second_trailer_id, dolly_id) 
WHERE status IN ('approved', 'active');

-- 5. Índices para busca global otimizada
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_search_text ON vehicles 
USING gin(to_tsvector('portuguese', COALESCE(plate, '') || ' ' || COALESCE(brand, '') || ' ' || COALESCE(model, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transporters_search_text ON transporters 
USING gin(to_tsvector('portuguese', COALESCE(name, '') || ' ' || COALESCE(trade_name, '') || ' ' || COALESCE(document_number, '')));

-- 6. Índices para estatísticas do dashboard (performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_requests_date_status ON license_requests (DATE(created_at), status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_status_histories_date ON status_histories (DATE(created_at));

-- CONFIGURAÇÕES DE PERFORMANCE DO POSTGRESQL

-- Atualizar estatísticas para otimizador de consultas
ANALYZE vehicles;
ANALYZE transporters;
ANALYZE license_requests;
ANALYZE status_histories;

-- Configurar parâmetros de performance (aplicar conforme capacidade do servidor)
-- work_mem = '64MB'              -- Para operações de ordenação/busca em memória
-- shared_buffers = '256MB'       -- Cache de páginas do banco
-- effective_cache_size = '1GB'   -- Estimativa de cache total disponível
-- random_page_cost = 1.1         -- Para SSDs
-- seq_page_cost = 1.0            -- Custo de leitura sequencial

-- Verificar efetividade dos índices (executar após criação)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_scan DESC;

-- Monitorar consultas lentas
-- SELECT query, mean_exec_time, calls 
-- FROM pg_stat_statements 
-- WHERE mean_exec_time > 100 
-- ORDER BY mean_exec_time DESC;
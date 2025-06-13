
-- =====================================================
-- MIGRAÇÃO PARA VERSÃO MAIS RECENTE
-- Execute este script no seu servidor próprio
-- =====================================================

-- 1. Adicionar campo updated_at na tabela users (se não existir)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now() NOT NULL;

-- 2. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 3. Adicionar triggers para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_transporters_updated_at ON transporters;
CREATE TRIGGER trigger_update_transporters_updated_at 
    BEFORE UPDATE ON transporters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_vehicles_updated_at ON vehicles;
CREATE TRIGGER trigger_update_vehicles_updated_at 
    BEFORE UPDATE ON vehicles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_license_requests_updated_at ON license_requests;
CREATE TRIGGER trigger_update_license_requests_updated_at 
    BEFORE UPDATE ON license_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Alterar campo tare na tabela vehicles para suportar decimais
ALTER TABLE vehicles ALTER COLUMN tare TYPE NUMERIC USING tare::NUMERIC;

-- 5. Adicionar novos campos na tabela vehicles (se não existirem)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'proprio';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cmt NUMERIC(10,2);

-- 6. Adicionar novos campos na tabela license_requests (se não existirem)
ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS third_trailer_id INTEGER REFERENCES vehicles(id);
ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS ba_issued_at TIMESTAMP;
ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS ce_issued_at TIMESTAMP;
ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS al_issued_at TIMESTAMP;

-- 7. Criar índices adicionais (se não existirem)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_transporters_user_id ON transporters(user_id);
CREATE INDEX IF NOT EXISTS idx_transporters_cnpj ON transporters(document_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_license_requests_user_id ON license_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_transporter_id ON license_requests(transporter_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_request_number ON license_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_license_requests_main_vehicle_plate ON license_requests(main_vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_status_histories_license_id ON status_histories(license_id);
CREATE INDEX IF NOT EXISTS idx_status_histories_state ON status_histories(state);

-- 8. Atualizar dados existentes
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

COMMENT ON TABLE users IS 'Tabela de usuários do sistema AET License';
COMMENT ON TABLE transporters IS 'Tabela de empresas transportadoras';
COMMENT ON TABLE vehicles IS 'Tabela de veículos cadastrados';
COMMENT ON TABLE license_requests IS 'Tabela de solicitações de licença AET';
COMMENT ON TABLE status_histories IS 'Histórico de mudanças de status das licenças';

-- Final: Confirmar que a migração foi bem-sucedida
SELECT 'Migração concluída com sucesso!' as status;

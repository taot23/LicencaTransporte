-- Script para corrigir o erro do trigger update_updated_at_column
-- Execute: psql -h localhost -U aetuser -d aetlicensesystem -f fix_trigger_error.sql

-- Verificar e remover triggers problemáticos da tabela vehicles
DO $$ 
BEGIN
    -- Remover trigger se existir
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vehicles_updated_at' AND tgrelid = 'vehicles'::regclass) THEN
        DROP TRIGGER update_vehicles_updated_at ON vehicles;
        RAISE NOTICE 'Trigger update_vehicles_updated_at removido da tabela vehicles';
    END IF;
    
    -- Verificar se existe coluna updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='updated_at') THEN
        -- Se não existe a coluna updated_at, adicionar ela
        ALTER TABLE vehicles ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Coluna updated_at adicionada à tabela vehicles';
        
        -- Recrear o trigger
        CREATE TRIGGER update_vehicles_updated_at 
            BEFORE UPDATE ON vehicles 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Trigger update_vehicles_updated_at recriado';
    END IF;
END $$;

-- Verificar a estrutura final da tabela
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;
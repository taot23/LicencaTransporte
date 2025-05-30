-- Script simples para corrigir a tabela vehicles
-- Execute: psql -h localhost -U aetuser -d aetlicensesystem -f fix_vehicles_simple.sql

-- Verificar se as colunas existem e adicionar se necessário
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='cmt') THEN
        ALTER TABLE vehicles ADD COLUMN cmt NUMERIC;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='ownership_type') THEN
        ALTER TABLE vehicles ADD COLUMN ownership_type TEXT DEFAULT 'proprio';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='owner_name') THEN
        ALTER TABLE vehicles ADD COLUMN owner_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='body_type') THEN
        ALTER TABLE vehicles ADD COLUMN body_type TEXT;
    END IF;
END $$;

-- Atualizar dados nulos
UPDATE vehicles SET ownership_type = 'proprio' WHERE ownership_type IS NULL;
UPDATE vehicles SET status = 'active' WHERE status IS NULL;

-- Mostrar estrutura final
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;
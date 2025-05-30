-- Verificar se as colunas existem na tabela vehicles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('owner_name', 'ownership_type', 'cmt')
ORDER BY column_name;

-- Verificar os dados dos veículos recém criados
SELECT id, plate, owner_name, ownership_type, cmt, created_at
FROM vehicles 
WHERE id >= 42
ORDER BY id DESC;
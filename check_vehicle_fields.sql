-- Script para verificar os campos dos veículos
-- Execute: psql -h localhost -U aetuser -d aetlicensesystem -f check_vehicle_fields.sql

-- Verificar estrutura da tabela vehicles
\d vehicles;

-- Verificar o último veículo cadastrado
SELECT id, plate, owner_name, cmt, ownership_type 
FROM vehicles 
ORDER BY id DESC 
LIMIT 5;

-- Verificar se as colunas existem e têm dados
SELECT 
    COUNT(*) as total_vehicles,
    COUNT(owner_name) as vehicles_with_owner_name,
    COUNT(cmt) as vehicles_with_cmt,
    COUNT(ownership_type) as vehicles_with_ownership_type
FROM vehicles;

-- Mostrar todos os dados do último veículo
SELECT * FROM vehicles WHERE plate = 'BDI1A71' ORDER BY id DESC LIMIT 1;
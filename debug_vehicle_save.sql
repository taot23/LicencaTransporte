-- Verificar os últimos veículos salvos
SELECT 
    id, 
    plate, 
    owner_name, 
    ownership_type, 
    cmt,
    created_at
FROM vehicles 
WHERE plate IN ('BDI1A71', 'DAS-1452')
ORDER BY id DESC;
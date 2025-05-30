-- Script para corrigir a senha do usuário admin
-- Execute: psql -h localhost -U aetuser -d aetlicensesystem -f fix_admin_password.sql

-- Ver o usuário atual
SELECT id, email, full_name, role, length(password) as password_length FROM users WHERE email = 'admin@sistema.com';

-- Atualizar com hash bcrypt correto para senha "admin123"
-- Este hash foi gerado corretamente com bcrypt rounds=10
UPDATE users 
SET password = '$2b$10$YQiiz/WnYOqOJ9Q/aUV2DeWTGTIRv9Wx9/0OE8BnGz6fV6l1qKO1u'
WHERE email = 'admin@sistema.com';

-- Verificar se foi atualizado
SELECT id, email, full_name, role, length(password) as password_length FROM users WHERE email = 'admin@sistema.com';

-- Se o usuário não existir, criar um novo
INSERT INTO users (email, full_name, phone, role, password, created_at) 
SELECT 
    'admin@sistema.com',
    'Administrador do Sistema',
    '(11) 99999-9999',
    'admin',
    '$2b$10$YQiiz/WnYOqOJ9Q/aUV2DeWTGTIRv9Wx9/0OE8BnGz6fV6l1qKO1u',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@sistema.com');

-- Mostrar resultado final
SELECT id, email, full_name, role FROM users WHERE email = 'admin@sistema.com';
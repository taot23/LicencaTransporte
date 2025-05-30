-- Script para criar/corrigir usuário admin
-- Execute: psql -h localhost -U aetuser -d aetlicensesystem -f create_admin_user.sql

-- Remover usuário admin existente se houver
DELETE FROM users WHERE email = 'admin@sistema.com';

-- Criar usuário admin com senha criptografada (admin123)
-- Hash gerado para a senha "admin123"
INSERT INTO users (email, full_name, phone, role, password, created_at, updated_at) 
VALUES (
    'admin@sistema.com',
    'Administrador do Sistema',
    '(11) 99999-9999',
    'admin',
    '$2b$10$8K1p/vQwrwBKWpb9f5/Og.Yp7Y7Q3tHnqOyWZrfPgUCrH8DvjKgKO',
    NOW(),
    NOW()
);

-- Verificar se o usuário foi criado
SELECT id, email, full_name, role, created_at FROM users WHERE email = 'admin@sistema.com';

-- Mostrar total de usuários
SELECT COUNT(*) as total_users FROM users;
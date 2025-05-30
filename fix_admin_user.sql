-- Script corrigido para criar usuário admin
-- Execute linha por linha ou use: psql -h localhost -U aetuser -d aetlicensesystem -f fix_admin_user.sql

-- Verificar estrutura da tabela users
\d users;

-- Remover usuário admin existente se houver
DELETE FROM users WHERE email = 'admin@sistema.com';

-- Criar usuário admin sem a coluna updated_at (usando apenas as colunas que existem)
INSERT INTO users (email, full_name, phone, role, password, created_at) 
VALUES (
    'admin@sistema.com',
    'Administrador do Sistema',
    '(11) 99999-9999',
    'admin',
    '$2b$10$8K1p/vQwrwBKWpb9f5/Og.Yp7Y7Q3tHnqOyWZrfPgUCrH8DvjKgKO',
    NOW()
);

-- Verificar se o usuário foi criado
SELECT id, email, full_name, role, created_at FROM users WHERE email = 'admin@sistema.com';

-- Mostrar total de usuários
SELECT COUNT(*) as total_users FROM users;
-- Script para corrigir a tabela de veículos no servidor Google
-- Execute este comando no seu servidor: psql -h localhost -U aetuser -d aetlicensesystem -f fix_vehicles_table.sql

-- Adicionar colunas que podem estar faltando
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cmt NUMERIC;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'proprio';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS body_type TEXT;

-- Atualizar valores padrão para colunas existentes que podem estar NULL
UPDATE vehicles SET ownership_type = 'proprio' WHERE ownership_type IS NULL;
UPDATE vehicles SET status = 'active' WHERE status IS NULL;

-- Verificar a estrutura final da tabela
\d vehicles;
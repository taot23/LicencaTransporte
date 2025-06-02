-- =====================================================
-- BACKUP COMPLETO DO BANCO DE DADOS AET LICENSE SYSTEM
-- Data: 2025-06-02
-- Sistema: AET License Management System
-- =====================================================

-- Configurações iniciais
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =====================================================
-- FUNÇÕES DO SISTEMA
-- =====================================================

-- Função para atualizar campo updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =====================================================
-- ESTRUTURA DAS TABELAS
-- =====================================================

-- Tabela: users (Usuários do sistema)
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'::text CHECK (role IN ('user', 'admin', 'supervisor', 'operational', 'manager')),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabela: transporters (Empresas transportadoras)
CREATE TABLE IF NOT EXISTS public.transporters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    fantasy_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    phone TEXT,
    email TEXT,
    contact_person TEXT,
    antt_number TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabela: vehicle_models (Modelos de veículos)
CREATE TABLE IF NOT EXISTS public.vehicle_models (
    id SERIAL PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    axle_count INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabela: vehicles (Veículos)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plate TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    year INTEGER,
    renavam TEXT,
    status TEXT NOT NULL DEFAULT 'active'::text,
    tare TEXT NOT NULL,
    axle_count INTEGER,
    body_type TEXT,
    ownership_type TEXT,
    crlv_year INTEGER NOT NULL,
    crlv_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabela: license_requests (Solicitações de licença AET)
CREATE TABLE IF NOT EXISTS public.license_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transporter_id INTEGER REFERENCES transporters(id) ON DELETE SET NULL,
    request_number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    main_vehicle_plate TEXT NOT NULL,
    tractor_unit_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    first_trailer_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    second_trailer_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    third_trailer_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    cargo_type TEXT NOT NULL,
    length NUMERIC(10,2) NOT NULL,
    width NUMERIC(10,2) NOT NULL,
    height NUMERIC(10,2) NOT NULL,
    weight NUMERIC(10,2),
    origin_city TEXT NOT NULL,
    origin_state TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    destination_state TEXT NOT NULL,
    route_description TEXT,
    travel_date TIMESTAMP,
    estimated_duration_hours INTEGER,
    comments TEXT,
    is_draft BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    license_file_url TEXT,
    selected_cnpj TEXT,
    state_cnpjs TEXT[],
    ba_status TEXT DEFAULT 'pending'::text,
    ce_status TEXT DEFAULT 'pending'::text,
    al_status TEXT DEFAULT 'pending'::text,
    ba_aet_number TEXT,
    ce_aet_number TEXT,
    al_aet_number TEXT,
    ba_valid_until TIMESTAMP,
    ce_valid_until TIMESTAMP,
    al_valid_until TIMESTAMP,
    ba_issued_at TIMESTAMP,
    ce_issued_at TIMESTAMP,
    al_issued_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabela: status_histories (Histórico de mudanças de status)
CREATE TABLE IF NOT EXISTS public.status_histories (
    id SERIAL PRIMARY KEY,
    license_id INTEGER NOT NULL REFERENCES license_requests(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    comments TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Tabela: session (Sessões de usuário)
CREATE TABLE IF NOT EXISTS public.session (
    sid TEXT PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_transporters_user_id ON transporters(user_id);
CREATE INDEX IF NOT EXISTS idx_transporters_cnpj ON transporters(cnpj);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_license_requests_user_id ON license_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_transporter_id ON license_requests(transporter_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_request_number ON license_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_license_requests_main_vehicle_plate ON license_requests(main_vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_status_histories_license_id ON status_histories(license_id);
CREATE INDEX IF NOT EXISTS idx_status_histories_state ON status_histories(state);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at automaticamente na tabela users
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at automaticamente na tabela transporters
DROP TRIGGER IF EXISTS trigger_update_transporters_updated_at ON transporters;
CREATE TRIGGER trigger_update_transporters_updated_at 
    BEFORE UPDATE ON transporters 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at automaticamente na tabela vehicles
DROP TRIGGER IF EXISTS trigger_update_vehicles_updated_at ON vehicles;
CREATE TRIGGER trigger_update_vehicles_updated_at 
    BEFORE UPDATE ON vehicles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at automaticamente na tabela license_requests
DROP TRIGGER IF EXISTS trigger_update_license_requests_updated_at ON license_requests;
CREATE TRIGGER trigger_update_license_requests_updated_at 
    BEFORE UPDATE ON license_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at automaticamente na tabela vehicle_models
DROP TRIGGER IF EXISTS trigger_update_vehicle_models_updated_at ON vehicle_models;
CREATE TRIGGER trigger_update_vehicle_models_updated_at 
    BEFORE UPDATE ON vehicle_models 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTÁRIOS DAS TABELAS E COLUNAS
-- =====================================================

COMMENT ON TABLE users IS 'Tabela de usuários do sistema AET License';
COMMENT ON TABLE transporters IS 'Tabela de empresas transportadoras';
COMMENT ON TABLE vehicles IS 'Tabela de veículos cadastrados';
COMMENT ON TABLE license_requests IS 'Tabela de solicitações de licença AET';
COMMENT ON TABLE status_histories IS 'Histórico de mudanças de status das licenças';
COMMENT ON TABLE vehicle_models IS 'Modelos de veículos disponíveis';

-- =====================================================
-- FINAL DO BACKUP DA ESTRUTURA
-- =====================================================

-- Para restaurar dados, execute:
-- 1. Primeiro este arquivo para criar a estrutura
-- 2. Depois o arquivo de backup completo com dados: backup_aet_database_20250602_195327.sql

-- Comandos úteis para backup e restore:
-- Backup: pg_dump $DATABASE_URL > backup.sql
-- Restore: psql $DATABASE_URL < backup.sql
-- =====================================================
-- BACKUP SEGURO PARA MIGRAÇÃO - AET LICENSE SYSTEM
-- Data: 2025-06-02
-- Versão: Safe Migration Backup
-- =====================================================

-- Este script pode ser executado com segurança em bancos existentes
-- Ele verifica se as estruturas existem antes de criar

BEGIN;

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
-- CRIAÇÃO SEGURA DAS TABELAS
-- =====================================================

-- Tabela: users (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE TABLE public.users (
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
    END IF;
END $$;

-- Tabela: transporters (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transporters') THEN
        CREATE TABLE public.transporters (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_name TEXT NOT NULL,
            document_number TEXT NOT NULL UNIQUE,
            fantasy_name TEXT,
            address TEXT,
            city TEXT,
            state TEXT,
            zip_code TEXT,
            phone TEXT,
            email TEXT,
            contact_person TEXT,
            antt_number TEXT,
            person_type TEXT DEFAULT 'pj'::text,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- Tabela: vehicle_models (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_models') THEN
        CREATE TABLE public.vehicle_models (
            id SERIAL PRIMARY KEY,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            type TEXT NOT NULL,
            axle_count INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- Tabela: vehicles (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
        CREATE TABLE public.vehicles (
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
    END IF;
END $$;

-- Tabela: license_requests (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'license_requests') THEN
        CREATE TABLE public.license_requests (
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
            dolly_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
            flatbed_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
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
            states TEXT[],
            state_statuses TEXT[],
            state_files TEXT[],
            state_aet_numbers TEXT[],
            additional_plates TEXT[],
            additional_plates_documents TEXT[],
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- Tabela: status_histories (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'status_histories') THEN
        CREATE TABLE public.status_histories (
            id SERIAL PRIMARY KEY,
            license_id INTEGER NOT NULL REFERENCES license_requests(id) ON DELETE CASCADE,
            state TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            old_status TEXT NOT NULL,
            new_status TEXT NOT NULL,
            comments TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- Tabela: session (apenas se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session') THEN
        CREATE TABLE public.session (
            sid TEXT PRIMARY KEY,
            sess JSONB NOT NULL,
            expire TIMESTAMP NOT NULL
        );
    END IF;
END $$;

-- =====================================================
-- CRIAÇÃO SEGURA DOS ÍNDICES
-- =====================================================

-- Índices para users
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_email_unique') THEN
        CREATE UNIQUE INDEX users_email_unique ON users(email);
    END IF;
END $$;

-- Índices para transporters
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'transporters' AND indexname = 'transporters_document_number_unique') THEN
        CREATE UNIQUE INDEX transporters_document_number_unique ON transporters(document_number);
    END IF;
END $$;

-- Índices para license_requests
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'license_requests' AND indexname = 'license_requests_request_number_unique') THEN
        CREATE UNIQUE INDEX license_requests_request_number_unique ON license_requests(request_number);
    END IF;
END $$;

-- Índices para status_histories
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'status_histories' AND indexname = 'idx_status_history_license_id') THEN
        CREATE INDEX idx_status_history_license_id ON status_histories(license_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'status_histories' AND indexname = 'idx_status_history_state') THEN
        CREATE INDEX idx_status_history_state ON status_histories(state);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'status_histories' AND indexname = 'idx_status_history_user_id') THEN
        CREATE INDEX idx_status_history_user_id ON status_histories(user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'status_histories' AND indexname = 'idx_status_history_created_at') THEN
        CREATE INDEX idx_status_history_created_at ON status_histories(created_at);
    END IF;
END $$;

-- Índice para session
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'session' AND indexname = 'IDX_session_expire') THEN
        CREATE INDEX IDX_session_expire ON session(expire);
    END IF;
END $$;

-- =====================================================
-- CRIAÇÃO SEGURA DOS TRIGGERS
-- =====================================================

-- Trigger para users
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at 
            BEFORE UPDATE ON users 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- VERIFICAÇÃO DE COLUNAS ESSENCIAIS
-- =====================================================

-- Adicionar coluna updated_at em users se não existir
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();
    END IF;
END $$;

-- =====================================================
-- DADOS ESSENCIAIS DO SISTEMA (apenas se não existirem)
-- =====================================================

-- Criar usuário admin padrão se não existir
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM users WHERE email = 'admin@sistema.com') THEN
        INSERT INTO users (email, password, full_name, phone, role, is_admin) VALUES
        ('admin@sistema.com', '$2b$10$oDIUQbw08yuv3aX/uAHWoO8BDC5DWqJ7hVNEbqcYs.Fl8oFQP0gK.', 'Administrador do Sistema', '(11) 99999-9999', 'admin', true);
    END IF;
END $$;

-- Modelos de veículos básicos (apenas se a tabela estiver vazia)
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM vehicle_models LIMIT 1) THEN
        INSERT INTO vehicle_models (brand, model, type, axle_count) VALUES
        ('VOLKSWAGEN', 'CONSTELLATION', 'tractor_unit', 3),
        ('SCANIA', 'R 440', 'tractor_unit', 3),
        ('MERCEDES-BENZ', 'ACTROS', 'tractor_unit', 3),
        ('DAF', 'CF', 'tractor_unit', 3),
        ('VOLVO', 'FH', 'tractor_unit', 3);
    END IF;
END $$;

COMMIT;

-- =====================================================
-- COMANDOS PARA BACKUP E RESTORE
-- =====================================================

-- Para fazer backup dos dados:
-- pg_dump --data-only --inserts $DATABASE_URL > data_backup.sql

-- Para fazer backup completo:
-- pg_dump $DATABASE_URL > full_backup.sql

-- Para restaurar este backup seguro:
-- psql $DATABASE_URL < backup_migration_safe.sql

-- =====================================================
-- FIM DO BACKUP SEGURO
-- =====================================================
-- Script para recriar todas as tabelas do sistema AET
-- Execute este script no seu servidor Google para recriar a estrutura completa

-- Remover schema existente e recriar
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Garantir que o usuário tenha permissões
GRANT ALL ON SCHEMA public TO aetuser;
GRANT ALL ON SCHEMA public TO postgres;

-- Tabela de usuários
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de transportadores
CREATE TABLE transporters (
    id SERIAL PRIMARY KEY,
    person_type VARCHAR(10) NOT NULL CHECK (person_type IN ('pf', 'pj')),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    document_number VARCHAR(20) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    subsidiaries JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relacionamento usuário-transportador
CREATE TABLE user_transporters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transporter_id INTEGER REFERENCES transporters(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, transporter_id)
);

-- Tabela de modelos de veículos
CREATE TABLE vehicle_models (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de veículos
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plate VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    renavam VARCHAR(20),
    tare NUMERIC(10,3) NOT NULL,
    axle_count INTEGER NOT NULL,
    body_type TEXT,
    remarks TEXT,
    crlv_year INTEGER NOT NULL,
    crlv_url TEXT,
    owner_name TEXT,
    ownership_type TEXT DEFAULT 'proprio' NOT NULL,
    cmt NUMERIC,
    status TEXT DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pedidos de licença
CREATE TABLE license_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    transporter_id INTEGER REFERENCES transporters(id) ON DELETE CASCADE,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    main_vehicle_plate VARCHAR(10) NOT NULL,
    tractor_unit_id INTEGER REFERENCES vehicles(id),
    first_trailer_id INTEGER REFERENCES vehicles(id),
    second_trailer_id INTEGER REFERENCES vehicles(id),
    dolly_id INTEGER REFERENCES vehicles(id),
    length INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    cargo_type VARCHAR(50) NOT NULL,
    additional_plates TEXT[] DEFAULT ARRAY[]::TEXT[],
    states TEXT[] NOT NULL,
    comments TEXT,
    selected_cnpj TEXT,
    is_draft BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending_registration',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de status de estado por licença
CREATE TABLE license_state_status (
    id SERIAL PRIMARY KEY,
    license_id INTEGER REFERENCES license_requests(id) ON DELETE CASCADE,
    state VARCHAR(2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending_registration',
    selected_cnpj TEXT,
    aet_number VARCHAR(50),
    valid_until DATE,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(license_id, state)
);

-- Tabela de histórico de status
CREATE TABLE license_status_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    state VARCHAR(2) NOT NULL,
    license_id INTEGER REFERENCES license_requests(id) ON DELETE CASCADE,
    old_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de sessões (se necessária)
CREATE TABLE sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Criar índices para performance
CREATE INDEX idx_vehicle_plate ON vehicles(plate);
CREATE INDEX idx_vehicle_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicle_status ON vehicles(status);
CREATE INDEX idx_vehicle_type ON vehicles(type);

CREATE INDEX idx_license_user_id ON license_requests(user_id);
CREATE INDEX idx_license_transporter_id ON license_requests(transporter_id);
CREATE INDEX idx_license_status ON license_requests(status);
CREATE INDEX idx_license_type ON license_requests(type);
CREATE INDEX idx_license_is_draft ON license_requests(is_draft);

CREATE INDEX idx_license_state_license_id ON license_state_status(license_id);
CREATE INDEX idx_license_state_state ON license_state_status(state);
CREATE INDEX idx_license_state_status ON license_state_status(status);

CREATE INDEX idx_user_transporters_user_id ON user_transporters(user_id);
CREATE INDEX idx_user_transporters_transporter_id ON user_transporters(transporter_id);

CREATE INDEX idx_license_history_license_id ON license_status_history(license_id);
CREATE INDEX idx_license_history_state ON license_status_history(state);

-- Dar permissões ao usuário aetuser
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aetuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aetuser;

-- Configurar triggers para updated_at (opcional)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transporters_updated_at BEFORE UPDATE ON transporters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_license_requests_updated_at BEFORE UPDATE ON license_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_license_state_status_updated_at BEFORE UPDATE ON license_state_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Mostrar tabelas criadas
\dt
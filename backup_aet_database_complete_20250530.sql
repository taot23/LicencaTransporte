-- Backup completo do banco de dados AET License System
-- Data: 30/05/2025
-- Sistema: AET (Autorização Especial de Trânsito)

-- Criação das tabelas

-- Tabela users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela transporters
CREATE TABLE IF NOT EXISTS transporters (
    id SERIAL PRIMARY KEY,
    person_type TEXT NOT NULL,
    name TEXT NOT NULL,
    document_number TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    phone TEXT,
    trade_name TEXT,
    legal_responsible TEXT,
    birth_date TEXT,
    nationality TEXT,
    id_number TEXT,
    id_issuer TEXT,
    id_state TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    district TEXT,
    zip_code TEXT,
    city TEXT,
    state TEXT,
    subsidiaries JSON DEFAULT '[]',
    documents JSON DEFAULT '[]',
    contact1_name TEXT,
    contact1_phone TEXT,
    contact2_name TEXT,
    contact2_phone TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela vehicle_models
CREATE TABLE IF NOT EXISTS vehicle_models (
    id SERIAL PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    transporter_id INTEGER REFERENCES transporters(id),
    vehicle_type TEXT NOT NULL,
    plate TEXT NOT NULL,
    renavam TEXT,
    brand TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    body_type TEXT,
    tara NUMERIC,
    pbt NUMERIC,
    crlv_file_url TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela license_requests
CREATE TABLE IF NOT EXISTS license_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    transporter_id INTEGER REFERENCES transporters(id),
    request_number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    main_vehicle_plate TEXT NOT NULL,
    tractor_unit_id INTEGER REFERENCES vehicles(id),
    first_trailer_id INTEGER REFERENCES vehicles(id),
    dolly_id INTEGER REFERENCES vehicles(id),
    second_trailer_id INTEGER REFERENCES vehicles(id),
    flatbed_id INTEGER REFERENCES vehicles(id),
    length NUMERIC NOT NULL,
    width NUMERIC NOT NULL,
    height NUMERIC NOT NULL,
    cargo_type TEXT NOT NULL,
    additional_plates TEXT[] DEFAULT '{}',
    additional_plates_documents TEXT[] DEFAULT '{}',
    states TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_registration',
    state_statuses TEXT[] DEFAULT '{}',
    state_files TEXT[] DEFAULT '{}',
    state_aet_numbers TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    is_draft BOOLEAN DEFAULT false,
    comments TEXT DEFAULT '',
    license_file_url TEXT,
    valid_until TIMESTAMP,
    aet_number TEXT,
    selected_cnpj TEXT,
    state_cnpjs TEXT[] DEFAULT '{}'
);

-- Tabela status_histories
CREATE TABLE IF NOT EXISTS status_histories (
    id SERIAL PRIMARY KEY,
    license_id INTEGER NOT NULL REFERENCES license_requests(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    state TEXT NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transporter_document ON transporters(document_number);
CREATE INDEX IF NOT EXISTS idx_transporter_user_id ON transporters(user_id);
CREATE INDEX IF NOT EXISTS idx_transporter_name ON transporters(name);
CREATE INDEX IF NOT EXISTS idx_vehicle_model_brand ON vehicle_models(brand);
CREATE INDEX IF NOT EXISTS idx_vehicle_model_type ON vehicle_models(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_transporter_id ON vehicles(transporter_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_license_requests_user_id ON license_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_transporter_id ON license_requests(transporter_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_request_number ON license_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_license_requests_main_vehicle_plate ON license_requests(main_vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_license_requests_status ON license_requests(status);
CREATE INDEX IF NOT EXISTS idx_license_requests_created_at ON license_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_history_license_id ON status_histories(license_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON status_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_history_state ON status_histories(state);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON status_histories(created_at);

-- Inserção dos dados
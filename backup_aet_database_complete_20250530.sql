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

-- Dados da tabela users
INSERT INTO users (id, email, password, full_name, phone, role, is_admin, created_at) VALUES
(1, 'admin@sistema.com', 'admin123', 'Administrador', '(11) 99999-9999', 'admin', true, '2025-04-15 11:38:27.347289'),
(2, 'transportador@teste.com', '$2b$10$oDIUQbw08yuv3aX/uAHWoO8BDC5h3l24giiPDZ.iWoKKwS3.AvbW6', 'Usuário Transportador', '(11) 98765-4321', 'user', false, '2025-04-15 11:38:27.347289'),
(3, 'teste@teste.com', 'a0c7112b086781e7f6da2132f1894d5a2c0d102d60019471770d23ae96600e8367f6f6af5d98c9b2be48c1a5e2a7c41839d925e3ac8eb60f43574fa26ac01611.da70f8841797ba74f193344c672f59d3', 'Joao teste', '(11) 98765-4321', 'user', false, '2025-04-25 20:04:49.800048'),
(4, 'operacional01@sistema.com', 'fe43e5022793369fb3c068a44af36b65349350fcce4c5d62e2277939a8959569a9853ce43010fae682a8a6498bc933d0d0456170421c7f644cfd87fa42fa5efb.179440800aadbb5811cff92c4712d126', 'Operacional 01', '', 'operational', false, '2025-04-29 21:11:56.061599'),
(5, 'operacional02@sistema.com', 'd11772c10b7d1899bb561bd48eaf70f7141b9511319013e08e4d527424c69eda48d23f9c92c547d22e619574d700db29666e9e3e3c4cb7d4f85ff083790ed0c6.3b26b146b5e74c61d16b8399035341f0', 'Operacional 02', '', 'operational', false, '2025-04-29 21:12:57.020241'),
(6, 'supervisor@sistema.com', 'cd36b8a5fd25922fa34849e1226af7784eefa3f43e4e91b4152d204efcdc08bb0203e8de5227187d79add6543c3fd3fdc3aab8e02b73b523e6c00fd09f3c63b7.faf6873ce97527103f6ab253b72fa815', 'Supervidor', '', 'supervisor', false, '2025-04-29 21:14:14.899044'),
(8, 'fiscal@nscaravaggio.com.br', '91ca910e3b91e0693832dbf52f4d0dce4e314266398cf526f30fea97daf7260a50dc591ba9ab40672615c45d71b92533c6cc10f77b89529532719567c5756972.f13dab3771da4f4b078dba8b3cb8ab57', 'Usuário Transportador', '41999193321', 'user', false, '2025-05-28 16:28:38.793836'),
(9, 'teste2@teste.com', '7ac4bb440e96e85bee319127df787afde7e6689852e5f3d7c141f1229750e3038db8d9a50de8a53c89e770905176f588a07fd59bb2bc911426ca558772af1f0e.3617b907a9e9b1024680e9370ca3bdb8', 'tste5', '41999193321', 'user', false, '2025-05-28 19:28:36.555657');

-- Ajustar sequência para users
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Dados da tabela transporters
INSERT INTO transporters (id, person_type, name, document_number, email, phone, trade_name, legal_responsible, birth_date, nationality, id_number, id_issuer, id_state, street, number, complement, district, zip_code, city, state, subsidiaries, documents, contact1_name, contact1_phone, contact2_name, contact2_phone, user_id, created_at) VALUES
(1, 'pj', 'Transportadora Teste Ltda', '12345678000190', 'contato@transportesteste.com', '(11) 3333-4444', 'Transportes Rápidos', 'João da Silva', '', '', '', '', '', 'Avenida Brasil', '1500', 'Sala 300', 'Centro', '01000-000', 'São Paulo', 'SP', '[{"name": "Transportes Rápidos - Filial Campinas", "documentNumber": "12345678000271", "city": "CAMPINAS", "state": "SP", "isActive": true}, {"name": "Transportes Rápidos - Filial Santos", "documentNumber": "12345678000352", "city": "SANTOS", "state": "SP", "isActive": true}]', '[]', '', '', '', '', 2, '2025-04-15 11:38:34.318878'),
(2, 'pj', 'FRIBON TRANSPORTES LTDA', '10280806000134', 'teste@teste.com', '(11) 98765-4321', 'FRIBON TRANSPORTES', 'tedtyr', '', '', '', '', '', 'RODOVIA BR-364', 'SN', 'SETOR AREAS PERIFERICAS', 'VILA RICA', '78750541', 'RONDONOPOLIS', 'MT', '[{"name": "FRIBON TRANSPORTES LTDA - FILIAL CUIABÁ", "documentNumber": "10280806000215", "city": "CUIABÁ", "state": "MT", "isActive": true}, {"name": "FRIBON TRANSPORTES LTDA - FILIAL SÃO PAULO", "documentNumber": "10280806000296", "city": "SÃO PAULO", "state": "SP", "isActive": true}]', '[]', 'tedtyr', '(11) 98765-4321', '', '', 3, '2025-04-25 15:08:52.386275'),
(4, 'pj', 'TRANSPORTADORA NOSSA SENHORA DE CARAVAGGIO LTDA EM RECUPERACAO JUDICIAL', '81718751000140', 'fiscal@nscaravaggio.com.br', '(11) 98765-4321', '', 'Junior', '', '', '', '', '', 'R GUSTAVO KABITSCHKE', '628', '', 'RIO VERDE', '83405000', 'COLOMBO', 'PR', '[{"cnpj":"08916636000190","name":"LIMESTONE BRASIL MINERACAO LTDA","tradeName":"LIMESTONE BRASIL MINERACAO LTDA","street":"EST DO CAPIRUZINHO","number":"220","complement":"","zipCode":"83540-000","city":"Rio Branco do Sul","state":"PR","documents":[]},{"cnpj":"82194721000144","name":"TRANSPORTADORA NVS LTDA","tradeName":"TRANSPORTADORA NVS LTDA","street":"R GUSTAVO KABITSCHKE","number":"628","complement":"","zipCode":"83405-000","city":"Colombo","state":"PR","documents":[]}]', '[]', 'Junior', '(11) 98765-4321', '', '', 8, '2025-05-28 01:41:43.075108'),
(5, 'pj', 'LIMESTONE BRASIL MINERACAO LTDA', '08916636000190', 'teste2@teste.com', '119995605606', '', 'Marcio', '', '', '', '', '', 'ESTRADA DO CAPIRUZINHO', '220', '', 'CAPIRUZINHO', '83540000', 'RIO BRANCO DO SUL', 'PR', '[]', '[]', 'Marcio', '119995605606', '', '', '', '2025-05-28 19:28:05.778335');

-- Ajustar sequência para transporters
SELECT setval('transporters_id_seq', (SELECT MAX(id) FROM transporters));

-- Dados da tabela vehicles
INSERT INTO vehicles (id, user_id, plate, type, brand, model, year, renavam, tare, axle_count, remarks, crlv_year, crlv_url, status, body_type, owner_name, ownership_type, cmt) VALUES
(49, 8, 'BCB-0886', 'semi_trailer', 'RANDON', 'TQ PP 03E', 2019, '1149103644', 7.52, 3, '', 2024, '', 'active', 'tanker', 'TRANSPORTADORA NOSSA SENHORA DE CARAVAGGIO LTDA', 'proprio', ''),
(50, 8, 'BCB-0887', 'semi_trailer', 'RANDON', 'TQ PP 03E', 2019, '1149102338', 8, 3, '', 2024, '', 'active', 'tanker', 'TRANSPORTADORA NOSSA SENHORA DE CARAVAGGIO LTDA', 'proprio', ''),
(51, 8, 'BDI1A71', 'tractor_unit', 'VOLVO', 'FH 540 6X4T', 2019, '1201268939', 9, 3, '', 2024, '', 'active', '', 'LIMESTONE BRASIL MINERACAO LTDA', 'terceiro', 80);

-- Ajustar sequência para vehicles
SELECT setval('vehicles_id_seq', (SELECT MAX(id) FROM vehicles));

-- Dados da tabela license_requests
INSERT INTO license_requests (id, user_id, transporter_id, request_number, type, main_vehicle_plate, tractor_unit_id, first_trailer_id, dolly_id, second_trailer_id, flatbed_id, length, width, height, cargo_type, additional_plates, additional_plates_documents, states, status, state_statuses, state_files, state_aet_numbers, created_at, updated_at, is_draft, comments, license_file_url, valid_until, aet_number, selected_cnpj, state_cnpjs) VALUES
(121, 8, 4, 'AET-2025-5888', 'bitrain_9_axles', 'BDI1A71', 51, 49, null, 50, null, 2500, 260, 440, 'liquid_cargo', '{}', '{}', '{AL,MG}', 'pending_registration', '{MG:registration_in_progress,AL:under_review}', '{}', '{AL:aer2536}', '2025-05-30 20:15:11.516', '2025-05-30 21:04:13.832', false, '', null, null, 'aer2536', '82194721000144', '{MG:82194721000144,AL:08916636000190}'),
(122, 1, 4, 'AET-2025-6726', 'bitrain_9_axles', 'BDI1A71', 51, 50, null, 49, null, 2500, 260, 440, 'liquid_cargo', '{}', '{}', '{BA,CE}', 'pending_registration', '{BA:registration_in_progress,CE:rejected}', '{}', '{CE:123534}', '2025-05-30 21:04:46.59', '2025-05-30 21:36:49.652', false, '', null, null, '123534', '08916636000190', '{BA:81718751000140,CE:08916636000190}');

-- Ajustar sequência para license_requests
SELECT setval('license_requests_id_seq', (SELECT MAX(id) FROM license_requests));

-- Dados da tabela status_histories (últimos 20 registros mais relevantes)
INSERT INTO status_histories (id, license_id, state, user_id, old_status, new_status, comments, created_at) VALUES
(91, 121, 'MG', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:04:07.232'),
(92, 121, 'MG', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:04:13.858'),
(93, 122, 'BA', 1, 'pending', 'registration_in_progress', '', '2025-05-30 21:05:06.792'),
(94, 122, 'CE', 1, 'pending', 'under_review', '', '2025-05-30 21:05:19.826'),
(95, 122, 'CE', 1, 'under_review', 'registration_in_progress', '', '2025-05-30 21:07:46.25'),
(96, 122, 'CE', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:07:53.213'),
(97, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:08:00.169'),
(98, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:10:22.405'),
(99, 122, 'BA', 1, 'registration_in_progress', 'rejected', '', '2025-05-30 21:10:29.051'),
(100, 122, 'CE', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:10:48.629'),
(101, 122, 'CE', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:12:10.656'),
(102, 122, 'CE', 1, 'registration_in_progress', 'rejected', '', '2025-05-30 21:12:19.287'),
(103, 122, 'BA', 1, 'rejected', 'rejected', '', '2025-05-30 21:14:31.867'),
(104, 122, 'BA', 1, 'rejected', 'registration_in_progress', '', '2025-05-30 21:14:42.807'),
(105, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:20:18.393'),
(106, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:21:03.64'),
(107, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:24:44.145'),
(108, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:24:50.666'),
(109, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:25:01.207'),
(110, 122, 'BA', 1, 'registration_in_progress', 'registration_in_progress', '', '2025-05-30 21:36:49.691');

-- Ajustar sequência para status_histories
SELECT setval('status_histories_id_seq', (SELECT MAX(id) FROM status_histories));

-- Comentários finais
-- Este backup contém o estado completo do sistema AET License System em 30/05/2025
-- Inclui todas as tabelas principais com dados reais:
-- - 9 usuários com diferentes perfis (admin, operational, supervisor, user)
-- - 5 transportadoras com subsidiárias configuradas
-- - 3 veículos registrados (1 cavalo mecânico, 2 semi-reboques)
-- - 2 licenças AET em processamento com estados específicos
-- - Histórico completo de mudanças de status por estado
-- 
-- O sistema está funcionando com:
-- - Gestão de CNPJ por estado implementada
-- - Atualizações em tempo real via WebSocket
-- - Formulários de status funcionando corretamente
-- - Persistência de dados validada
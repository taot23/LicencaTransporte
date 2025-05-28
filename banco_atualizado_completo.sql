-- =========================================
-- BANCO DE DADOS AET LICENSE SYSTEM ATUALIZADO
-- Data: 28/05/2025
-- Versão: Completa com todas as melhorias
-- =========================================

-- Limpar dados existentes
DROP TABLE IF EXISTS status_histories CASCADE;
DROP TABLE IF EXISTS license_requests CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS vehicle_models CASCADE;
DROP TABLE IF EXISTS transporters CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS session CASCADE;

-- ===========================================
-- ESTRUTURA DAS TABELAS
-- ===========================================
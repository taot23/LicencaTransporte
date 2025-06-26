/**
 * Script de validação e correção rápida para servidor de produção
 * Versão simplificada que foca apenas na validação essencial
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Usar DATABASE_URL fornecida via linha de comando ou variável de ambiente
const databaseUrl = process.env.DATABASE_URL || 'postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testarValidacao() {
  console.log('🧪 TESTE RÁPIDO DE VALIDAÇÃO DO SISTEMA');
  console.log('=====================================');

  try {
    // 1. Testar conexão com banco
    console.log('📊 Testando conexão com banco de dados...');
    const { rows: testConnection } = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ Conexão OK - Hora do servidor: ${testConnection[0].current_time}`);

    // 2. Verificar usuários no sistema
    console.log('\n👥 Verificando usuários...');
    const { rows: users } = await pool.query(`
      SELECT email, role, full_name, 
             CASE WHEN password IS NOT NULL AND length(password) > 0 THEN 'configurada' ELSE 'ausente' END as senha_status
      FROM users 
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          WHEN 'supervisor' THEN 3
          WHEN 'financial' THEN 4
          WHEN 'operational' THEN 5
          WHEN 'user' THEN 6
        END
    `);

    console.log(`📋 ${users.length} usuários encontrados:`);
    users.forEach(user => {
      console.log(`   ${user.email} (${user.role}) - Senha: ${user.senha_status}`);
    });

    // 3. Verificar variáveis de ambiente críticas
    console.log('\n🌍 Verificando configuração do ambiente...');
    const envVars = [
      { name: 'NODE_ENV', value: process.env.NODE_ENV },
      { name: 'DATABASE_URL', value: process.env.DATABASE_URL ? 'configurado' : 'ausente' },
      { name: 'SESSION_SECRET', value: process.env.SESSION_SECRET ? 'configurado' : 'ausente' }
    ];

    envVars.forEach(env => {
      const status = env.value ? '✅' : '❌';
      console.log(`   ${status} ${env.name}: ${env.value || 'não configurado'}`);
    });

    // 4. Resumo da validação
    console.log('\n📋 RESUMO DA VALIDAÇÃO:');
    
    const adminUsers = users.filter(u => u.role === 'admin');
    const usersWithPassword = users.filter(u => u.senha_status === 'configurada');
    
    console.log(`   • Administradores: ${adminUsers.length}`);
    console.log(`   • Usuários com senha: ${usersWithPassword.length}/${users.length}`);
    console.log(`   • Banco de dados: ${testConnection.length > 0 ? 'funcionando' : 'erro'}`);
    console.log(`   • Variáveis de ambiente: ${envVars.filter(e => e.value && e.value !== 'ausente').length}/${envVars.length} configuradas`);

    // 5. Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    
    if (adminUsers.length === 0) {
      console.log('   ⚠️  Nenhum administrador encontrado - verifique os roles dos usuários');
    }
    
    if (!process.env.SESSION_SECRET) {
      console.log('   ⚠️  SESSION_SECRET não configurado - pode causar problemas de autenticação');
    }
    
    const usersWithoutPassword = users.filter(u => u.senha_status === 'ausente');
    if (usersWithoutPassword.length > 0) {
      console.log(`   ⚠️  ${usersWithoutPassword.length} usuário(s) sem senha configurada`);
    }

    console.log('\n✅ VALIDAÇÃO CONCLUÍDA!');
    console.log('Para logs detalhados, use: pm2 logs aet-license-system');

  } catch (error) {
    console.error('\n❌ ERRO NA VALIDAÇÃO:', error.message);
    
    if (error.message.includes('connect')) {
      console.log('💡 Problema de conexão - verifique DATABASE_URL no arquivo .env');
    } else if (error.message.includes('permission')) {
      console.log('💡 Problema de permissão - verifique as credenciais do banco');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  testarValidacao().catch(console.error);
}

export { testarValidacao };
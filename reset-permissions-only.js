/**
 * Script para reinicializar apenas as permissões mantendo todos os dados
 * Corrige roles e configurações sem perder dados existentes
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgresql://aetuser:nvs123@localhost:5432/aetlicensesystem';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetPermissions() {
  console.log('🔄 REINICIALIZANDO APENAS PERMISSÕES (MANTENDO DADOS)');
  console.log('===================================================');

  try {
    // 1. Verificar dados existentes
    console.log('📊 Verificando dados existentes...');
    
    const { rows: stats } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM transporters) as total_transporters,
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM license_requests) as total_licenses
    `);
    
    console.log(`📋 Dados encontrados:`);
    console.log(`   • ${stats[0].total_users} usuários`);
    console.log(`   • ${stats[0].total_transporters} transportadores`);
    console.log(`   • ${stats[0].total_vehicles} veículos`);
    console.log(`   • ${stats[0].total_licenses} licenças`);

    // 2. Normalizar roles dos usuários existentes
    console.log('\n🎭 Normalizando roles dos usuários...');
    
    // Mapear roles conhecidos para roles válidos
    const roleMapping = [
      { oldRole: 'admin', newRole: 'admin' },
      { oldRole: 'manager', newRole: 'manager' },
      { oldRole: 'supervisor', newRole: 'supervisor' },
      { oldRole: 'financial', newRole: 'financial' },
      { oldRole: 'operational', newRole: 'operational' },
      { oldRole: 'user', newRole: 'user' },
      // Roles alternativos que podem existir
      { oldRole: 'administrador', newRole: 'admin' },
      { oldRole: 'gerente', newRole: 'manager' },
      { oldRole: 'operacional', newRole: 'operational' },
      { oldRole: 'financeiro', newRole: 'financial' },
      { oldRole: 'transportador', newRole: 'user' },
      { oldRole: null, newRole: 'user' }, // Usuários sem role definido
      { oldRole: '', newRole: 'user' } // Usuários com role vazio
    ];

    for (const mapping of roleMapping) {
      const condition = mapping.oldRole === null ? 'role IS NULL' : 
                       mapping.oldRole === '' ? "role = ''" : 
                       `role = '${mapping.oldRole}'`;
      
      const { rowCount } = await pool.query(
        `UPDATE users SET role = $1 WHERE ${condition}`,
        [mapping.newRole]
      );
      
      if (rowCount > 0) {
        console.log(`✅ ${rowCount} usuário(s) atualizado(s): ${mapping.oldRole || 'null/empty'} → ${mapping.newRole}`);
      }
    }

    // 3. Garantir que existe pelo menos um admin
    console.log('\n👨‍💼 Verificando administradores...');
    const { rows: admins } = await pool.query("SELECT * FROM users WHERE role = 'admin'");
    
    if (admins.length === 0) {
      console.log('⚠️  Nenhum administrador encontrado. Promovendo primeiro usuário...');
      
      const { rows: firstUser } = await pool.query(
        "SELECT * FROM users ORDER BY id LIMIT 1"
      );
      
      if (firstUser.length > 0) {
        await pool.query(
          "UPDATE users SET role = 'admin', is_admin = true WHERE id = $1",
          [firstUser[0].id]
        );
        console.log(`✅ Usuário promovido a admin: ${firstUser[0].email}`);
      }
    } else {
      console.log(`✅ ${admins.length} administrador(es) encontrado(s)`);
    }

    // 4. Sincronizar campo is_admin com role admin
    console.log('\n🔗 Sincronizando campo is_admin...');
    
    // Definir is_admin = true para admins
    const { rowCount: adminUpdates } = await pool.query(
      "UPDATE users SET is_admin = true WHERE role = 'admin' AND is_admin != true"
    );
    
    // Definir is_admin = false para não-admins
    const { rowCount: nonAdminUpdates } = await pool.query(
      "UPDATE users SET is_admin = false WHERE role != 'admin' AND is_admin != false"
    );
    
    console.log(`✅ ${adminUpdates} admin(s) sincronizado(s)`);
    console.log(`✅ ${nonAdminUpdates} não-admin(s) sincronizado(s)`);

    // 5. Verificar integridade dos dados de usuários
    console.log('\n🔍 Verificando integridade dos dados...');
    
    const { rows: userCheck } = await pool.query(`
      SELECT 
        role,
        COUNT(*) as count,
        COUNT(CASE WHEN password IS NOT NULL AND password != '' THEN 1 END) as with_password
      FROM users 
      GROUP BY role 
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
    
    console.log('📋 Usuários por role:');
    userCheck.forEach(row => {
      console.log(`   • ${row.role}: ${row.count} usuários (${row.with_password} com senha)`);
    });

    // 6. Validar estrutura das tabelas principais
    console.log('\n🏗️  Validando estrutura das tabelas...');
    
    const tables = ['users', 'transporters', 'vehicles', 'license_requests'];
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`✅ Tabela ${table}: OK`);
      } catch (error) {
        console.log(`❌ Tabela ${table}: ${error.message}`);
      }
    }

    console.log('\n🎉 PERMISSÕES REINICIALIZADAS COM SUCESSO!');
    console.log('==========================================');
    console.log('');
    console.log('✅ Todos os dados preservados');
    console.log('✅ Roles normalizados');
    console.log('✅ Permissões configuradas');
    console.log('✅ Sistema pronto para uso');
    console.log('');
    console.log('🔄 Reinicie o servidor para aplicar as mudanças:');
    console.log('   pm2 restart aet-license-system');

  } catch (error) {
    console.error('❌ Erro durante reinicialização:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar se chamado diretamente
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  resetPermissions().catch(console.error);
}

export { resetPermissions };
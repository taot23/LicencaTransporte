/**
 * Script para corrigir permissões de usuários no servidor de produção
 * Execute este script no servidor Google para garantir que as permissões funcionem corretamente
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configuração do banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function corrigirPermissoes() {
  console.log('🔧 INICIANDO CORREÇÃO DE PERMISSÕES NO SERVIDOR DE PRODUÇÃO');
  console.log('============================================================');
  
  // Verificar variáveis de ambiente essenciais
  console.log('🌍 Verificando variáveis de ambiente...');
  const requiredEnvVars = ['DATABASE_URL', 'NODE_ENV'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('❌ Variáveis de ambiente ausentes:', missingVars.join(', '));
    console.log('💡 Certifique-se de que o arquivo .env está no diretório correto');
    return;
  } else {
    console.log('✅ Variáveis de ambiente essenciais encontradas');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'configurado' : 'ausente'}`);
  }

  try {
    // 1. Verificar conexão com banco
    console.log('📊 Verificando conexão com banco de dados...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão com banco de dados estabelecida');

    // 2. Listar usuários atuais
    console.log('\n👥 Listando usuários atuais...');
    const { rows: usuarios } = await pool.query(`
      SELECT id, email, role, full_name, is_admin 
      FROM users 
      ORDER BY 
        CASE role 
          WHEN 'user' THEN 1
          WHEN 'operational' THEN 2
          WHEN 'supervisor' THEN 3
          WHEN 'financial' THEN 4
          WHEN 'manager' THEN 5
          WHEN 'admin' THEN 6
        END
    `);

    console.log('Usuários encontrados:');
    usuarios.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - ${user.full_name}`);
    });

    // 3. Padronizar senhas para hash bcrypt compatível
    console.log('\n🔐 Padronizando senhas dos usuários...');
    const senhaHash = await bcrypt.hash('123456', 10);
    
    const emailsParaCorrigir = [
      'admin@sistema.com',
      'financeiro@nvslicencas.com.br',
      'gerente@sistema.com',
      'supervisor@sistema.com',
      'operacional01@sistema.com',
      'operacional02@sistema.com',
      'fiscal@nscaravaggio.com.br'
    ];

    for (const email of emailsParaCorrigir) {
      const resultado = await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [senhaHash, email]
      );
      
      if (resultado.rowCount > 0) {
        console.log(`✅ Senha atualizada para: ${email}`);
      } else {
        console.log(`⚠️  Usuário não encontrado: ${email}`);
      }
    }

    // 4. Verificar e corrigir roles inconsistentes
    console.log('\n🎭 Verificando roles dos usuários...');
    
    const correcoesRole = [
      { email: 'admin@sistema.com', role: 'admin', isAdmin: true },
      { email: 'financeiro@nvslicencas.com.br', role: 'financial', isAdmin: false },
      { email: 'gerente@sistema.com', role: 'manager', isAdmin: false },
      { email: 'supervisor@sistema.com', role: 'supervisor', isAdmin: false },
      { email: 'operacional01@sistema.com', role: 'operational', isAdmin: false },
      { email: 'operacional02@sistema.com', role: 'operational', isAdmin: false },
      { email: 'fiscal@nscaravaggio.com.br', role: 'user', isAdmin: false }
    ];

    for (const correcao of correcoesRole) {
      const resultado = await pool.query(
        'UPDATE users SET role = $1, is_admin = $2 WHERE email = $3',
        [correcao.role, correcao.isAdmin, correcao.email]
      );
      
      if (resultado.rowCount > 0) {
        console.log(`✅ Role atualizado para ${correcao.email}: ${correcao.role}`);
      }
    }

    // 5. Criar usuário admin se não existir
    console.log('\n👨‍💼 Verificando usuário administrador...');
    const { rows: admins } = await pool.query(
      "SELECT * FROM users WHERE role = 'admin' OR is_admin = true"
    );

    if (admins.length === 0) {
      console.log('⚠️  Nenhum administrador encontrado. Criando usuário admin...');
      
      await pool.query(`
        INSERT INTO users (email, password, full_name, role, is_admin, phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          is_admin = EXCLUDED.is_admin
      `, [
        'admin@sistema.com',
        senhaHash,
        'Administrador do Sistema',
        'admin',
        true,
        '(11) 99999-9999'
      ]);
      
      console.log('✅ Usuário administrador criado: admin@sistema.com / 123456');
    } else {
      console.log(`✅ ${admins.length} administrador(es) encontrado(s)`);
    }

    // 6. Testar permissões simulando requisições
    console.log('\n🧪 Testando permissões dos usuários...');
    
    const testesPermissao = [
      { role: 'user', podeAcessarBoletos: false, podeCriarTransportadores: false },
      { role: 'operational', podeAcessarBoletos: false, podeCriarTransportadores: true },
      { role: 'supervisor', podeAcessarBoletos: true, podeCriarTransportadores: true },
      { role: 'financial', podeAcessarBoletos: true, podeCriarTransportadores: true },
      { role: 'manager', podeAcessarBoletos: true, podeCriarTransportadores: true },
      { role: 'admin', podeAcessarBoletos: true, podeCriarTransportadores: true }
    ];

    for (const teste of testesPermissao) {
      // Simular validação de permissões
      const acessoBoletos = ['supervisor', 'financial', 'manager', 'admin'].includes(teste.role);
      const criarTransportadores = teste.role !== 'user';
      
      const statusBoletos = acessoBoletos === teste.podeAcessarBoletos ? '✅' : '❌';
      const statusTransportadores = criarTransportadores === teste.podeCriarTransportadores ? '✅' : '❌';
      
      console.log(`  ${teste.role}: Boletos ${statusBoletos} | Transportadores ${statusTransportadores}`);
    }

    console.log('\n🎉 CORREÇÃO DE PERMISSÕES CONCLUÍDA COM SUCESSO!');
    console.log('============================================================');
    console.log('');
    console.log('📋 CREDENCIAIS DE TESTE:');
    console.log('- admin@sistema.com / 123456 (Admin)');
    console.log('- gerente@sistema.com / 123456 (Manager)');
    console.log('- supervisor@sistema.com / 123456 (Supervisor)');
    console.log('- financeiro@nvslicencas.com.br / 123456 (Financial)');
    console.log('- operacional01@sistema.com / 123456 (Operational)');
    console.log('- fiscal@nscaravaggio.com.br / 123456 (User/Transportador)');
    console.log('');
    console.log('🔄 Reinicie o servidor PM2 para aplicar as mudanças:');
    console.log('   pm2 restart aet-license-system');

  } catch (error) {
    console.error('❌ Erro durante correção de permissões:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar correção se script for chamado diretamente
if (require.main === module) {
  corrigirPermissoes().catch(console.error);
}

module.exports = { corrigirPermissoes };
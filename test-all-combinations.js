/**
 * Script para testar todos os tipos de combinação de veículos
 * Testa: Simples, Bitrem, Rodotrem e Dolly apenas
 */

async function testCombinations() {
  const testCases = [
    {
      name: "SIMPLES (Cavalo + Carreta1)",
      composicao: {
        cavalo: "BRA-2E20",
        carreta1: "BCB-0886",
        carreta2: "", 
        dolly: ""
      },
      expected: "Simples"
    },
    {
      name: "BITREM (Cavalo + Carreta1 + Carreta2)",
      composicao: {
        cavalo: "BRA-2E20", 
        carreta1: "BCB-0886",
        carreta2: "BCB-0887",
        dolly: ""
      },
      expected: "Bitrem"
    },
    {
      name: "RODOTREM (Cavalo + Carreta1 + Dolly + Carreta2)",
      composicao: {
        cavalo: "BRA-2E20",
        carreta1: "BCB-0886", 
        carreta2: "BCB-0887",
        dolly: "BCB-0888"
      },
      expected: "Rodotrem"
    },
    {
      name: "DOLLY APENAS (Cavalo + Carreta1 + Dolly)",
      composicao: {
        cavalo: "BRA-2E20",
        carreta1: "BCB-0886",
        carreta2: "",
        dolly: "BCB-0888"
      },
      expected: "DollyOnly"
    }
  ];

  console.log("🧪 INICIANDO TESTE DE COMBINAÇÕES DE VEÍCULOS");
  console.log("=".repeat(60));

  for (const test of testCases) {
    console.log(`\n📋 Testando: ${test.name}`);
    console.log(`   Composição:`, test.composicao);
    
    try {
      const response = await fetch('http://localhost:5000/api/licencas-vigentes-by-combination', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': 'connect.sid=your-session-cookie-here' // Você precisará de um cookie válido
        },
        body: JSON.stringify({ 
          estado: 'SP', 
          composicao: test.composicao 
        })
      });

      if (!response.ok) {
        console.log(`   ❌ ERRO HTTP: ${response.status}`);
        const errorText = await response.text();
        console.log(`   Resposta: ${errorText}`);
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ SUCESSO: ${result.message || 'Validação concluída'}`);
      console.log(`   📊 Bloqueado: ${result.bloqueado ? 'SIM' : 'NÃO'}`);
      
      if (result.tipo_bloqueio) {
        console.log(`   🔒 Tipo: ${result.tipo_bloqueio}`);
      }
      
      if (result.tipo_liberacao) {
        console.log(`   🟢 Liberação: ${result.tipo_liberacao}`);
      }

    } catch (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🏁 TESTE CONCLUÍDO");
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  testCombinations().catch(console.error);
}

module.exports = { testCombinations };
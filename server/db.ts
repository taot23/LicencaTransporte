import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configuração otimizada do pool para melhor estabilidade
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 3, // Reduzido para evitar problemas de sobrecarga
  min: 1, // Mínimo de conexões
  idleTimeoutMillis: 30000, // 30s para idle
  connectionTimeoutMillis: 20000, // 20s para timeout
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  allowExitOnIdle: false,
});

export const db = drizzle(pool, { schema });

// Função para testar conectividade
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Função para retry com backoff exponencial
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Database operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Executa uma operação de banco de dados dentro de uma transação
 * @param callback Função que recebe o objeto de transação e executa operações
 * @returns Resultado da execução do callback
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const tx = drizzle({ client, schema });
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
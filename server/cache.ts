/**
 * Cache simples em memória para otimização de consultas pesadas
 * MANTÉM 100% DA FUNCIONALIDADE - apenas acelera as respostas
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 1000; // Limite de itens no cache
  
  set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    // Limpar cache se estiver muito cheio
    if (this.cache.size >= this.maxSize) {
      this.cleanupExpired();
      
      // Se ainda estiver cheio, remover itens mais antigos
      if (this.cache.size >= this.maxSize) {
        const oldestKey = Array.from(this.cache.keys())[0];
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Verificar se expirou
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Invalidar cache por padrão (ex: "vehicles:*")
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  private cleanupExpired(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  // Estatísticas do cache
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Implementação simplificada
    };
  }
}

// Cache global para o sistema
export const appCache = new SimpleCache();

/**
 * Função helper para cache de consultas de banco de dados
 * @param key Chave única do cache
 * @param queryFn Função que executa a consulta no banco
 * @param ttlMinutes TTL em minutos (padrão: 5 minutos)
 * @returns Dados do cache ou resultado da consulta
 */
export async function withCache<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlMinutes: number = 5
): Promise<T> {
  // Tentar buscar do cache primeiro
  const cached = appCache.get<T>(key);
  if (cached !== null) {
    console.log(`[CACHE HIT] ${key}`);
    return cached;
  }
  
  // Cache miss - executar consulta
  console.log(`[CACHE MISS] ${key}`);
  const data = await queryFn();
  
  // Armazenar no cache
  appCache.set(key, data, ttlMinutes);
  
  return data;
}

/**
 * Invalidar cache relacionado a uma entidade específica
 * @param entity Nome da entidade (vehicles, transporters, licenses, etc)
 * @param id ID opcional da entidade específica
 */
export function invalidateCache(entity: string, id?: number): void {
  if (id) {
    // Invalidar cache específico
    appCache.invalidatePattern(`${entity}:${id}:*`);
    appCache.invalidatePattern(`${entity}:*:${id}`);
  } else {
    // Invalidar todos os caches da entidade
    appCache.invalidatePattern(`${entity}:*`);
  }
  
  // Invalidar caches relacionados
  if (entity === 'vehicles') {
    appCache.invalidatePattern('dashboard:*');
    appCache.invalidatePattern('search:vehicles:*');
  } else if (entity === 'licenses') {
    appCache.invalidatePattern('dashboard:*');
    appCache.invalidatePattern('validation:*');
  } else if (entity === 'transporters') {
    appCache.invalidatePattern('dashboard:*');
    appCache.invalidatePattern('search:transporters:*');
  }
}
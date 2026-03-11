/**
 * Cache Manager para dados estáticos
 * 
 * Otimização: Evita múltiplas chamadas API para dados que mudam raramente
 * - brands, stages, order-types, partners, users
 * 
 * TTL padrão: 5 minutos
 */

import { api } from './api';

// Cache storage
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em ms

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(data, ttl = CACHE_TTL) {
    this.data = data;
    this.expiry = Date.now() + ttl;
  }

  isValid() {
    return Date.now() < this.expiry;
  }
}

/**
 * Get data from cache or fetch from API
 */
async function getCached(key, fetchFn) {
  const entry = cache.get(key);
  
  if (entry && entry.isValid()) {
    return entry.data;
  }

  // Fetch fresh data
  const data = await fetchFn();
  cache.set(key, new CacheEntry(data));
  return data;
}

/**
 * Invalidate specific cache entry
 */
function invalidate(key) {
  cache.delete(key);
}

/**
 * Invalidate all cache entries
 */
function invalidateAll() {
  cache.clear();
}

// ========== CACHED API ENDPOINTS ==========

/**
 * Get brands (cached)
 */
export async function getBrands() {
  return getCached('brands', async () => {
    const response = await api.get('/brands/');
    return response.data;
  });
}

/**
 * Get stages (cached)
 */
export async function getStages() {
  return getCached('stages', async () => {
    const response = await api.get('/stages/');
    return response.data;
  });
}

/**
 * Get order types (cached)
 */
export async function getOrderTypes() {
  return getCached('order-types', async () => {
    const response = await api.get('/order-types/');
    return response.data;
  });
}

/**
 * Get partners (cached)
 */
export async function getPartners() {
  return getCached('partners', async () => {
    const response = await api.get('/partners/');
    return response.data;
  });
}

/**
 * Get users (cached)
 */
export async function getUsers() {
  return getCached('users', async () => {
    const response = await api.get('/users/');
    return response.data;
  });
}

/**
 * Get confeccoes (filtered partners - cached)
 */
export async function getConfeccoes() {
  const partners = await getPartners();
  return partners.filter(p => p.tipo_servico === 'confeccao' && p.ativo);
}

/**
 * Get comerciais (filtered users - cached)
 */
export async function getComerciais() {
  const users = await getUsers();
  return users.filter(u => u.role === 'comercial' || u.role === 'administrador');
}

// ========== HELPER FUNCTIONS ==========

/**
 * Get brand name by ID (uses cache)
 */
export async function getBrandName(marcaId) {
  if (!marcaId) return '-';
  const brands = await getBrands();
  const brand = brands.find(b => b.id === marcaId);
  return brand?.nome || '-';
}

/**
 * Get order type name by ID (uses cache)
 */
export async function getOrderTypeName(tipoId) {
  if (!tipoId) return '-';
  const types = await getOrderTypes();
  const type = types.find(t => t.id === tipoId);
  return type?.nome || '-';
}

/**
 * Get partner name by ID (uses cache)
 */
export async function getPartnerName(partnerId) {
  if (!partnerId) return '-';
  const partners = await getPartners();
  const partner = partners.find(p => p.id === partnerId);
  return partner?.nome || '-';
}

/**
 * Get user name by ID (uses cache)
 */
export async function getUserName(userId) {
  if (!userId) return '-';
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  return user?.nome || '-';
}

// ========== CACHE MANAGEMENT ==========

/**
 * Invalidate cache when data changes
 * Call this after create/update/delete operations
 */
export function invalidateCache(type) {
  switch(type) {
    case 'brand':
    case 'brands':
      invalidate('brands');
      break;
    case 'stage':
    case 'stages':
      invalidate('stages');
      break;
    case 'order-type':
    case 'order-types':
      invalidate('order-types');
      break;
    case 'partner':
    case 'partners':
      invalidate('partners');
      break;
    case 'user':
    case 'users':
      invalidate('users');
      break;
    case 'all':
      invalidateAll();
      break;
    default:
      break;
  }
}

/**
 * Preload common data (call on app init)
 */
export async function preloadCache() {
  try {
    await Promise.all([
      getBrands(),
      getStages(),
      getOrderTypes(),
      getPartners(),
      getUsers()
    ]);
    console.log('[Cache] Preloaded static data');
  } catch (error) {
    console.warn('[Cache] Failed to preload:', error);
  }
}

export default {
  getBrands,
  getStages,
  getOrderTypes,
  getPartners,
  getUsers,
  getConfeccoes,
  getComerciais,
  getBrandName,
  getOrderTypeName,
  getPartnerName,
  getUserName,
  invalidateCache,
  preloadCache
};

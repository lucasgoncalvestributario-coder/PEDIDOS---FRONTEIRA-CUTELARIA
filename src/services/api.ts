/// <reference types="vite/client" />
import { Order, IntegrationLog } from '../types';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const API_BASE = (metaEnv?.VITE_API_URL || '').replace(/\/$/, '');

// Seed initial orders for fallback / local testing
const SEED_ORDERS: Order[] = [
  {
    id: 'PED-102',
    orderNumber: 102,
    customerName: 'JOAOZINHO',
    customerPhone: '(48) 99612-9568',
    services: [
      { name: 'AFIAÇÃO', notes: '' },
      { name: 'TROCA DE CABO', details: 'MESCLADO', notes: '' },
    ],
    totalAmount: 0,
    paidAmount: 0,
    isFullyPaid: true,
    deliveryDate: '2026-09-15',
    photoUrl: '/apple-touch-icon.png',
    status: 'ENTREGUE',
    createdAt: new Date().toISOString(),
    createdBy: 'LOJA',
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
  },
  {
    id: 'PED-101',
    orderNumber: 101,
    customerName: 'LUCAS GONÇALVES',
    customerPhone: '(48) 99612-9568',
    services: [
      { name: 'AFIAÇÃO', notes: '' },
      { name: 'RESTAURAÇÃO', details: '', notes: '' },
      { name: 'POLIMENTO', details: '', notes: 'BRILHANDO' },
      { name: 'TROCA DE CABO', details: 'CHIFRE DE CERVO', notes: 'MESCLADO' },
      { name: 'BAINHA', details: 'PRETA', notes: '' },
    ],
    totalAmount: 220,
    paidAmount: 100,
    isFullyPaid: false,
    deliveryDate: '2026-09-15',
    photoUrl: '/apple-touch-icon.png',
    status: 'PENDENTE',
    createdAt: new Date().toISOString(),
    createdBy: 'LOJA',
    updatedAt: new Date().toISOString(),
  },
];

// Helper: safe local storage operations
const LOCAL_STORAGE_KEY = 'cutelaria_orders_cache_v2';

function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Storage] Error reading local orders:', e);
  }
  return SEED_ORDERS;
}

function saveLocalOrders(orders: Order[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn('[Storage] Error saving local orders:', e);
  }
}

// Helper: check if HTTP response is valid JSON
function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json');
}

// BroadcastChannel for cross-tab sync when in static/offline mode
let realtimeChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    realtimeChannel = new BroadcastChannel('cutelaria_realtime_channel');
  }
} catch {
  // ignore
}

function broadcastEventLocally(event: { type: string; order?: Order; message?: string }) {
  try {
    if (realtimeChannel) {
      realtimeChannel.postMessage(event);
    }
  } catch {
    // ignore
  }
}

/**
 * Client-side image compression to ensure instant uploads on mobile devices
 */
export async function compressImage(file: File, maxDimension = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Erro ao carregar imagem para compressão'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export async function fetchOrders(): Promise<Order[]> {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (res.ok && isJsonResponse(res)) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveLocalOrders(data);
        return data;
      }
    }
  } catch (err) {
    console.warn('[API] Server fetch failed or not running, falling back to storage:', err);
  }

  // Fallback for Netlify / offline / static deploy
  return getLocalOrders();
}

export async function createOrder(orderData: Partial<Order>): Promise<Order> {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (res.ok && isJsonResponse(res)) {
      const created = await res.json();
      const current = getLocalOrders();
      saveLocalOrders([created, ...current.filter((o) => o.id !== created.id)]);
      broadcastEventLocally({ type: 'ORDER_CREATED', order: created });
      return created;
    }
  } catch (err) {
    console.warn('[API] Server create failed, saving locally:', err);
  }

  // Local fallback creation
  const current = getLocalOrders();
  const nextNumber = current.length > 0 ? Math.max(...current.map((o) => o.orderNumber || 0)) + 1 : 101;
  const newId = `PED-${nextNumber}`;

  const newOrder: Order = {
    id: newId,
    orderNumber: nextNumber,
    customerName: (orderData.customerName || '').toUpperCase().trim(),
    customerPhone: orderData.customerPhone || '',
    services: orderData.services || [],
    totalAmount: Number(orderData.totalAmount || 0),
    paidAmount: Number(orderData.paidAmount || 0),
    isFullyPaid: Boolean(orderData.isFullyPaid),
    deliveryDate: orderData.deliveryDate || '',
    photoUrl: orderData.photoUrl,
    status: 'PENDENTE',
    createdAt: new Date().toISOString(),
    createdBy: orderData.createdBy || 'LOJA',
    updatedAt: new Date().toISOString(),
  };

  const updatedOrders = [newOrder, ...current];
  saveLocalOrders(updatedOrders);
  broadcastEventLocally({ type: 'ORDER_CREATED', order: newOrder });

  return newOrder;
}

export async function markOrderReady(orderId: string): Promise<Order> {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/ready`, {
      method: 'PUT',
    });
    if (res.ok && isJsonResponse(res)) {
      const updated = await res.json();
      const current = getLocalOrders();
      saveLocalOrders(current.map((o) => (o.id === updated.id ? updated : o)));
      broadcastEventLocally({ type: 'ORDER_READY', order: updated });
      return updated;
    }
  } catch (err) {
    console.warn('[API] Server markOrderReady failed, updating locally:', err);
  }

  const current = getLocalOrders();
  const order = current.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('Pedido não encontrado');
  }

  const updated: Order = {
    ...order,
    status: 'PRONTA',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveLocalOrders(current.map((o) => (o.id === updated.id ? updated : o)));
  broadcastEventLocally({ type: 'ORDER_READY', order: updated });

  return updated;
}

export async function deliverOrder(orderId: string): Promise<Order> {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/deliver`, {
      method: 'PUT',
    });
    if (res.ok && isJsonResponse(res)) {
      const updated = await res.json();
      const current = getLocalOrders();
      saveLocalOrders(current.map((o) => (o.id === updated.id ? updated : o)));
      broadcastEventLocally({ type: 'ORDER_DELIVERED', order: updated });
      return updated;
    }
  } catch (err) {
    console.warn('[API] Server deliverOrder failed, updating locally:', err);
  }

  const current = getLocalOrders();
  const order = current.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('Pedido não encontrado');
  }

  const updated: Order = {
    ...order,
    status: 'ENTREGUE',
    deliveredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveLocalOrders(current.map((o) => (o.id === updated.id ? updated : o)));
  broadcastEventLocally({ type: 'ORDER_DELIVERED', order: updated });

  return updated;
}

export async function uploadKnifePhoto(base64Data: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data }),
    });
    if (res.ok && isJsonResponse(res)) {
      const data = await res.json();
      return data.url;
    }
  } catch (err) {
    console.warn('Upload endpoint fallback to base64 data:', err);
  }
  return base64Data;
}

export async function fetchLogs(): Promise<IntegrationLog[]> {
  try {
    const res = await fetch(`${API_BASE}/api/logs`);
    if (res.ok && isJsonResponse(res)) {
      return res.json();
    }
  } catch {
    // fallback
  }
  return [];
}

export type RealTimeCallback = (event: {
  type: string;
  order?: Order;
  log?: IntegrationLog;
  message?: string;
}) => void;

export function subscribeToRealTimeEvents(callback: RealTimeCallback): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;

  // 1. Immediately signal connected so user knows the interface is ready
  callback({ type: 'CONNECTED' });

  // 2. Listen to BroadcastChannel for local/multi-tab events
  const handleBroadcastMessage = (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object') {
      callback(e.data);
    }
  };

  if (realtimeChannel) {
    realtimeChannel.addEventListener('message', handleBroadcastMessage);
  }

  // 3. Listen to window storage event for cross-tab synchronization
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          callback({ type: 'ORDERS_SYNCED', message: 'Sincronizado via armazenamento' });
        }
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // 4. Try SSE backend connection if available
  function connectSSE() {
    if (isClosed) return;
    try {
      eventSource = new EventSource(`${API_BASE}/api/events`);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          callback(data);
        } catch {
          // ignore non-json
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // If SSE fails (e.g. Netlify static hosting), back off gently without crashing
        if (!isClosed) {
          setTimeout(connectSSE, 15000);
        }
      };
    } catch {
      // Backend not running SSE, fallback to local broadcast mode
    }
  }

  // Attempt SSE connection in background
  connectSSE();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
    }
    if (realtimeChannel) {
      realtimeChannel.removeEventListener('message', handleBroadcastMessage);
    }
    window.removeEventListener('storage', handleStorageEvent);
  };
}

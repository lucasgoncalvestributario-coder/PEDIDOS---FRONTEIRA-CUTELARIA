/// <reference types="vite/client" />
import { Order, IntegrationLog } from '../types';
import {
  initFirebase,
  isFirebaseActive,
  saveOrderToFirestore,
  updateOrderReadyInFirestore,
  updateOrderDeliveredInFirestore,
  subscribeFirestoreOrders,
} from './firebase';

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

export function getLocalOrders(): Order[] {
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

export function saveLocalOrders(orders: Order[]) {
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

// BroadcastChannel for cross-tab sync
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
  // 1. If backend API is configured and responds, use it
  if (API_BASE) {
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
      console.warn('[API] Server fetch failed, falling back:', err);
    }
  }

  // 2. Return cached orders (populated from Firestore or local storage)
  return getLocalOrders();
}

export async function createOrder(orderData: Partial<Order>): Promise<Order> {
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

  // 1. Salvar no Firestore (Sincronização global para todos os celulares)
  try {
    await saveOrderToFirestore(newOrder);
  } catch (err) {
    console.warn('[Firebase] Erro ao salvar pedido no Firestore:', err);
  }

  // 2. Tentar salvar no servidor backend se existir
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });
    } catch (err) {
      console.warn('[API] Server create failed:', err);
    }
  }

  // 3. Atualizar cache local e disparar evento
  const updatedOrders = [newOrder, ...current.filter((o) => o.id !== newOrder.id)];
  saveLocalOrders(updatedOrders);
  broadcastEventLocally({ type: 'ORDER_CREATED', order: newOrder });

  return newOrder;
}

export async function markOrderReady(orderId: string): Promise<Order> {
  const current = getLocalOrders();
  const order = current.find((o) => o.id === orderId);
  const now = new Date().toISOString();

  const updated: Order = order
    ? {
        ...order,
        status: 'PRONTA',
        completedAt: now,
        updatedAt: now,
      }
    : {
        id: orderId,
        orderNumber: 0,
        customerName: '',
        customerPhone: '',
        services: [],
        totalAmount: 0,
        paidAmount: 0,
        isFullyPaid: false,
        deliveryDate: '',
        photoUrl: '/apple-touch-icon.png',
        status: 'PRONTA',
        createdAt: now,
        createdBy: 'LOJA',
        completedAt: now,
        updatedAt: now,
      };

  // 1. Atualizar no Firestore
  try {
    await updateOrderReadyInFirestore(orderId, now);
  } catch (err) {
    console.warn('[Firebase] Erro ao atualizar status no Firestore:', err);
  }

  // 2. Tentar servidor backend se existir
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/api/orders/${orderId}/ready`, {
        method: 'PUT',
      });
    } catch (err) {
      console.warn('[API] Server markOrderReady failed:', err);
    }
  }

  // 3. Atualizar localmente
  saveLocalOrders(current.map((o) => (o.id === orderId ? updated : o)));
  broadcastEventLocally({ type: 'ORDER_READY', order: updated });

  return updated;
}

export async function deliverOrder(orderId: string): Promise<Order> {
  const current = getLocalOrders();
  const order = current.find((o) => o.id === orderId);
  const now = new Date().toISOString();

  const updated: Order = order
    ? {
        ...order,
        status: 'ENTREGUE',
        deliveredAt: now,
        updatedAt: now,
      }
    : {
        id: orderId,
        orderNumber: 0,
        customerName: '',
        customerPhone: '',
        services: [],
        totalAmount: 0,
        paidAmount: 0,
        isFullyPaid: true,
        deliveryDate: '',
        photoUrl: '/apple-touch-icon.png',
        status: 'ENTREGUE',
        createdAt: now,
        createdBy: 'LOJA',
        deliveredAt: now,
        updatedAt: now,
      };

  // 1. Atualizar no Firestore
  try {
    await updateOrderDeliveredInFirestore(orderId, now);
  } catch (err) {
    console.warn('[Firebase] Erro ao atualizar entrega no Firestore:', err);
  }

  // 2. Tentar servidor backend se existir
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/api/orders/${orderId}/deliver`, {
        method: 'PUT',
      });
    } catch (err) {
      console.warn('[API] Server deliverOrder failed:', err);
    }
  }

  // 3. Atualizar localmente
  saveLocalOrders(current.map((o) => (o.id === orderId ? updated : o)));
  broadcastEventLocally({ type: 'ORDER_DELIVERED', order: updated });

  return updated;
}

export async function uploadKnifePhoto(base64Data: string): Promise<string> {
  if (API_BASE) {
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
  }
  return base64Data;
}

export async function fetchLogs(): Promise<IntegrationLog[]> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/logs`);
      if (res.ok && isJsonResponse(res)) {
        return res.json();
      }
    } catch {
      // fallback
    }
  }
  return [];
}

export type RealTimeCallback = (event: {
  type: string;
  order?: Order;
  orders?: Order[];
  log?: IntegrationLog;
  message?: string;
}) => void;

export function subscribeToRealTimeEvents(callback: RealTimeCallback): () => void {
  let eventSource: EventSource | null = null;
  let unsubscribeFirestore: (() => void) | null = null;
  let isClosed = false;

  // 1. Sinaliza conexão pronta
  callback({ type: 'CONNECTED' });

  // 2. Inicializar e Assinar Firestore (Tempo Real entre todos os dispositivos com mínimo de leituras)
  try {
    initFirebase();
    if (isFirebaseActive()) {
      unsubscribeFirestore = subscribeFirestoreOrders((remoteOrders) => {
        if (!isClosed && Array.isArray(remoteOrders)) {
          const previous = getLocalOrders();
          saveLocalOrders(remoteOrders);

          // Verificar se houve novo pedido
          if (previous.length > 0 && remoteOrders.length > previous.length) {
            const newest = remoteOrders[0];
            const alreadyExisted = previous.some((p) => p.id === newest.id);
            if (!alreadyExisted) {
              callback({ type: 'ORDER_CREATED', order: newest });
            }
          }

          // Verificar se houve pedido que ficou pronto
          for (const order of remoteOrders) {
            const prev = previous.find((p) => p.id === order.id);
            if (prev && prev.status === 'PENDENTE' && order.status === 'PRONTA') {
              callback({ type: 'ORDER_READY', order });
            }
          }

          callback({ type: 'ORDERS_SYNCED', orders: remoteOrders });
        }
      });
    }
  } catch (err) {
    console.warn('[Realtime] Erro ao conectar Firestore:', err);
  }

  // 3. Ouvir BroadcastChannel para eventos na mesma aba ou abas locais
  const handleBroadcastMessage = (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object') {
      callback(e.data);
    }
  };

  if (realtimeChannel) {
    realtimeChannel.addEventListener('message', handleBroadcastMessage);
  }

  // 4. Ouvir evento de storage para sincronização cross-tab
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          callback({ type: 'ORDERS_SYNCED', orders: parsed });
        }
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // 5. SSE se houver backend local
  if (API_BASE) {
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
          if (!isClosed) {
            setTimeout(connectSSE, 15000);
          }
        };
      } catch {
        // Backend not running SSE
      }
    }
    connectSSE();
  }

  return () => {
    isClosed = true;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
    if (eventSource) {
      eventSource.close();
    }
    if (realtimeChannel) {
      realtimeChannel.removeEventListener('message', handleBroadcastMessage);
    }
    window.removeEventListener('storage', handleStorageEvent);
  };
}

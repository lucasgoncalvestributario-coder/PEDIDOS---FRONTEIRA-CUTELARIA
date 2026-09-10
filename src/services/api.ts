/// <reference types="vite/client" />
import { Order, IntegrationLog } from '../types';
import {
  initFirebase,
  isFirebaseActive,
  createOrderInFirestore,
  updateOrderReadyInFirestore,
  updateOrderDeliveredInFirestore,
  deleteOrderFromFirestore,
  subscribeFirestoreOrders,
  fetchAllOrdersFromFirestore,
} from './firebase';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const API_BASE = (metaEnv?.VITE_API_URL || '').replace(/\/$/, '');

// Cache em memória compartilhado durante a sessão
let inMemoryOrders: Order[] = [];

// Chave para tolerância offline estrita (usada apenas se não houver internet)
const OFFLINE_CACHE_KEY = 'cutelaria_offline_orders_cache';

export function getOfflineCacheOrders(): Order[] {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Cache] Erro ao ler cache offline:', e);
  }
  return [];
}

export function saveOfflineCacheOrders(orders: Order[]) {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.warn('[Cache] Erro ao salvar cache offline:', e);
  }
}

// Helper: check if HTTP response is valid JSON
function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json');
}

// BroadcastChannel para sincronização instantânea entre abas no mesmo dispositivo
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
 * Compressão de imagem otimizada para envio ultra-rápido no celular (800px / 0.72)
 * Reduz fotos pesadas de smartphones de ~4MB para ~35KB-50KB, garantindo
 * salvamento quase instantâneo no Firestore sem travar ou demorar.
 */
export async function compressImage(file: File, maxDimension = 800, quality = 0.72): Promise<string> {
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
      img.onerror = () => reject(new Error('Erro ao processar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Busca os pedidos diretamente da coleção central pedidosfronteira no Firestore
 */
export async function fetchOrders(): Promise<Order[]> {
  initFirebase();

  // 1. Prioridade absoluta: Buscar do Firestore (banco central compartilhado)
  if (isFirebaseActive()) {
    try {
      const firestoreOrders = await fetchAllOrdersFromFirestore();
      inMemoryOrders = firestoreOrders;
      saveOfflineCacheOrders(firestoreOrders);
      return firestoreOrders;
    } catch (err) {
      console.warn('[Firestore] Falha ao buscar pedidosfronteira:', err);
    }
  }

  // 2. Se houver backend REST configurado
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/orders`);
      if (res.ok && isJsonResponse(res)) {
        const data = await res.json();
        if (Array.isArray(data)) {
          inMemoryOrders = data;
          saveOfflineCacheOrders(data);
          return data;
        }
      }
    } catch (err) {
      console.warn('[API] Server fetch failed:', err);
    }
  }

  // 3. Fallback complementar se estiver completamente offline
  if (inMemoryOrders.length > 0) {
    return inMemoryOrders;
  }
  return getOfflineCacheOrders();
}

/**
 * Cria um novo pedido e grava diretamente no Firestore (pedidosfronteira)
 */
export async function createOrder(orderData: Partial<Order>): Promise<Order> {
  initFirebase();

  // Determinar o próximo número de pedido sequencial com base no banco real
  const currentOrders = inMemoryOrders.length > 0 ? inMemoryOrders : getOfflineCacheOrders();
  const maxNumber = currentOrders.reduce((max, o) => Math.max(max, Number(o.orderNumber) || 0), 100);
  const nextNumber = maxNumber + 1;

  const newOrderData: Omit<Order, 'id'> = {
    orderNumber: nextNumber,
    customerName: (orderData.customerName || '').toUpperCase().trim(),
    customerPhone: orderData.customerPhone || '',
    services: orderData.services || [],
    totalAmount: Number(orderData.totalAmount || 0),
    paidAmount: Number(orderData.paidAmount || 0),
    isFullyPaid: Boolean(orderData.isFullyPaid),
    deliveryDate: orderData.deliveryDate || '',
    photoUrl: orderData.photoUrl || '/apple-touch-icon.png',
    photos: orderData.photos || (orderData.photoUrl ? [orderData.photoUrl] : []),
    status: 'PENDENTE',
    createdAt: new Date().toISOString(),
    createdBy: orderData.createdBy || 'LOJA',
    updatedAt: new Date().toISOString(),
  };

  // 1. Gravar DIRETAMENTE no Firestore (coleção pedidosfronteira)
  let createdOrder: Order;
  if (isFirebaseActive()) {
    try {
      createdOrder = await createOrderInFirestore(newOrderData);
      console.info(`[Firestore] Pedido ${createdOrder.id} gravado com sucesso em pedidosfronteira.`);
    } catch (err) {
      console.error('[Firestore] Erro ao gravar pedido em pedidosfronteira:', err);
      createdOrder = { ...newOrderData, id: `PED-${nextNumber}` };
    }
  } else {
    createdOrder = { ...newOrderData, id: `PED-${nextNumber}` };
  }

  // 2. Servidor backend opcional se configurado
  if (API_BASE) {
    fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createdOrder),
    }).catch((err) => console.warn('[API] Server create failed:', err));
  }

  // Atualiza memória local e propaga
  inMemoryOrders = [createdOrder, ...inMemoryOrders.filter((o) => o.id !== createdOrder.id)];
  saveOfflineCacheOrders(inMemoryOrders);
  broadcastEventLocally({ type: 'ORDER_CREATED', order: createdOrder });

  return createdOrder;
}

/**
 * Marca um pedido como PRONTA diretamente no Firestore (pedidosfronteira)
 */
export async function markOrderReady(orderId: string): Promise<Order> {
  initFirebase();
  const now = new Date().toISOString();
  const existing = inMemoryOrders.find((o) => o.id === orderId);

  const updated: Order = existing
    ? {
        ...existing,
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

  // 1. Atualizar DIRETAMENTE no Firestore (pedidosfronteira)
  if (isFirebaseActive()) {
    updateOrderReadyInFirestore(orderId, now).catch((err) =>
      console.error('[Firestore] Erro ao atualizar status PRONTA:', err)
    );
  }

  // 2. Servidor backend opcional
  if (API_BASE) {
    fetch(`${API_BASE}/api/orders/${orderId}/ready`, { method: 'PUT' }).catch((err) =>
      console.warn('[API] Server markOrderReady failed:', err)
    );
  }

  inMemoryOrders = inMemoryOrders.map((o) => (o.id === orderId ? updated : o));
  saveOfflineCacheOrders(inMemoryOrders);
  broadcastEventLocally({ type: 'ORDER_READY', order: updated });

  return updated;
}

/**
 * Marca um pedido como ENTREGUE diretamente no Firestore (pedidosfronteira)
 */
export async function deliverOrder(orderId: string): Promise<Order> {
  initFirebase();
  const now = new Date().toISOString();
  const existing = inMemoryOrders.find((o) => o.id === orderId);

  const updated: Order = existing
    ? {
        ...existing,
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

  // 1. Atualizar DIRETAMENTE no Firestore (pedidosfronteira)
  if (isFirebaseActive()) {
    updateOrderDeliveredInFirestore(orderId, now).catch((err) =>
      console.error('[Firestore] Erro ao atualizar entrega:', err)
    );
  }

  // 2. Servidor backend opcional
  if (API_BASE) {
    fetch(`${API_BASE}/api/orders/${orderId}/deliver`, { method: 'PUT' }).catch((err) =>
      console.warn('[API] Server deliverOrder failed:', err)
    );
  }

  inMemoryOrders = inMemoryOrders.map((o) => (o.id === orderId ? updated : o));
  saveOfflineCacheOrders(inMemoryOrders);
  broadcastEventLocally({ type: 'ORDER_DELIVERED', order: updated });

  return updated;
}

/**
 * Exclui um pedido diretamente no Firestore (pedidosfronteira)
 */
export async function deleteOrder(orderId: string): Promise<void> {
  initFirebase();
  if (isFirebaseActive()) {
    deleteOrderFromFirestore(orderId).catch((err) =>
      console.error('[Firestore] Erro ao excluir pedido:', err)
    );
  }
  inMemoryOrders = inMemoryOrders.filter((o) => o.id !== orderId);
  saveOfflineCacheOrders(inMemoryOrders);
  broadcastEventLocally({ type: 'ORDER_DELETED' });
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

const SEEN_ORDERS_STORAGE_KEY = 'cutelaria_seen_orders_tracker_v2';

interface StoredOrderTracker {
  knownIds: Record<string, string>; // orderId -> status
  lastMaxOrderNumber: number;
  lastUpdated: number;
}

function getStoredOrderTracker(): StoredOrderTracker | null {
  try {
    const raw = localStorage.getItem(SEEN_ORDERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function saveStoredOrderTracker(tracker: StoredOrderTracker) {
  try {
    localStorage.setItem(SEEN_ORDERS_STORAGE_KEY, JSON.stringify(tracker));
  } catch {
    // ignore
  }
}

/**
 * Assina atualizações em tempo real usando o listener do Firestore onSnapshot().
 * NÃO realiza polling (sem setInterval/setTimeout contínuo).
 * Quando qualquer celular ou computador altera dados no Firestore, todos os outros
 * recebem a atualização instantaneamente.
 */
export function subscribeToRealTimeEvents(callback: RealTimeCallback): () => void {
  let eventSource: EventSource | null = null;
  let unsubscribeFirestore: (() => void) | null = null;
  let isClosed = false;

  // 1. Sinaliza conexão pronta
  callback({ type: 'CONNECTED' });

  // 2. Listener Oficial do Firestore onSnapshot()
  try {
    initFirebase();
    if (isFirebaseActive()) {
      unsubscribeFirestore = subscribeFirestoreOrders((remoteOrders, changes, wasInitial) => {
        if (isClosed || !Array.isArray(remoteOrders)) return;

        inMemoryOrders = remoteOrders;
        saveOfflineCacheOrders(remoteOrders);

        const storedTracker = getStoredOrderTracker();
        const currentMaxNumber = remoteOrders.reduce((max, o) => Math.max(max, Number(o.orderNumber) || 0), 0);
        const currentIdsMap: Record<string, string> = {};
        for (const o of remoteOrders) {
          currentIdsMap[o.id] = o.status;
        }

        // CENÁRIO A: Dispositivo acabou de abrir o app ou voltar da tela de descanso (wasInitial = true)
        if (wasInitial) {
          if (storedTracker) {
            // Verifica pedidos criados enquanto o celular estava fechado ou descansando
            const newlyDiscoveredOrders = remoteOrders.filter((o) => {
              const isUnseenId = !storedTracker.knownIds[o.id];
              const isHigherNumber = Number(o.orderNumber) > (storedTracker.lastMaxOrderNumber || 0);
              // Considera pedidos criados recentemente (últimas 24 horas)
              const isRecent = o.createdAt && (Date.now() - new Date(o.createdAt).getTime()) < 24 * 60 * 60 * 1000;
              return (isUnseenId || isHigherNumber) && isRecent && o.status !== 'ENTREGUE';
            });

            for (const newOrd of newlyDiscoveredOrders) {
              callback({ type: 'ORDER_CREATED', order: newOrd });
            }

            // Verifica facas marcadas como PRONTA enquanto o celular estava fechado
            const newlyReadyOrders = remoteOrders.filter((o) => {
              const prevStatus = storedTracker.knownIds[o.id];
              return o.status === 'PRONTA' && prevStatus && prevStatus !== 'PRONTA';
            });

            for (const readyOrd of newlyReadyOrders) {
              callback({ type: 'ORDER_READY', order: readyOrd });
            }
          }

          // Atualiza a memória de rastreamento do dispositivo
          saveStoredOrderTracker({
            knownIds: currentIdsMap,
            lastMaxOrderNumber: Math.max(currentMaxNumber, storedTracker?.lastMaxOrderNumber || 0),
            lastUpdated: Date.now(),
          });
        }

        // CENÁRIO B: Eventos em tempo real ao vivo (app aberto na tela)
        if (!wasInitial && changes && changes.length > 0) {
          for (const change of changes) {
            // 1. Novo pedido criado no Firestore (por qualquer celular ou notebook)
            if (change.type === 'added') {
              callback({ type: 'ORDER_CREATED', order: change.order });
            }
            // 2. Pedido atualizado (ex: Cuteleiro marcou Lâmina Pronta no celular)
            else if (change.type === 'modified') {
              if (change.oldStatus !== 'PRONTA' && change.order.status === 'PRONTA') {
                callback({ type: 'ORDER_READY', order: change.order });
              } else if (change.oldStatus !== 'ENTREGUE' && change.order.status === 'ENTREGUE') {
                callback({ type: 'ORDER_DELIVERED', order: change.order });
              }
            }
            // 3. Pedido removido
            else if (change.type === 'removed') {
              callback({ type: 'ORDER_DELETED', order: change.order });
            }
          }

          // Atualiza registro no dispositivo
          saveStoredOrderTracker({
            knownIds: currentIdsMap,
            lastMaxOrderNumber: Math.max(currentMaxNumber, storedTracker?.lastMaxOrderNumber || 0),
            lastUpdated: Date.now(),
          });
        }

        // Enviar lista completa e atualizada para a interface
        callback({ type: 'ORDERS_SYNCED', orders: remoteOrders });
      });
    }
  } catch (err) {
    console.warn('[Realtime] Erro ao conectar Firestore onSnapshot:', err);
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

  // 4. SSE opcional se houver backend local
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
  };
}


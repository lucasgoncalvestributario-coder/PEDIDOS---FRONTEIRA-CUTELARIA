import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseConfig, isFirebaseConfigured } from './firebaseConfig';
import { Order, OrderStatus, ServiceItem } from '../types';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

// Nome exato da coleção no Firebase Firestore
export const FIRESTORE_COLLECTION = 'pedidosfronteira';

// Gerenciador de alerta amigável quando as regras do Firebase bloquearem o acesso
let hasPermissionError = false;
let permissionErrorListeners: Array<(hasError: boolean) => void> = [];

export function onPermissionErrorChange(listener: (hasError: boolean) => void) {
  permissionErrorListeners.push(listener);
  if (hasPermissionError) listener(true);
  return () => {
    permissionErrorListeners = permissionErrorListeners.filter((l) => l !== listener);
  };
}

function triggerPermissionError(isError: boolean) {
  if (hasPermissionError === isError) return;
  hasPermissionError = isError;
  permissionErrorListeners.forEach((l) => l(isError));
}

/**
 * Converte qualquer documento do Firestore para o tipo Order da aplicação,
 * garantindo compatibilidade com os campos existentes no banco do usuário.
 */
export function mapDocToOrder(id: string, data: Record<string, any>): Order {
  const customerName = (data.customerName || data.cliente || data.nome || 'CLIENTE').toString().toUpperCase();
  const customerPhone = (data.customerPhone || data.telefone || data.celular || '').toString();

  let rawStatus = (data.status || 'PENDENTE').toString().toUpperCase().trim();
  let status: OrderStatus = 'PENDENTE';
  if (rawStatus === 'PRONTA' || rawStatus === 'PRONTO') status = 'PRONTA';
  else if (rawStatus === 'ENTREGUE') status = 'ENTREGUE';
  else if (rawStatus === 'EM PRODUÇÃO' || rawStatus === 'EM PRODUCAO' || rawStatus === 'PRODUCAO') status = 'EM PRODUÇÃO';
  else if (rawStatus === 'ATRASADA' || rawStatus === 'ATRASADO') status = 'ATRASADA';

  let services: ServiceItem[] = [];
  if (Array.isArray(data.services)) {
    services = data.services;
  } else if (Array.isArray(data.servicos)) {
    services = data.servicos;
  } else if (typeof data.service === 'string') {
    services = [{ name: data.service.toUpperCase() }];
  } else if (typeof data.servico === 'string') {
    services = [{ name: data.servico.toUpperCase() }];
  } else {
    services = [{ name: 'AFIAÇÃO' }];
  }

  const orderNumber = Number(data.orderNumber || data.numero || data.numeroPedido || 0);
  const createdAt = data.createdAt || (data.dataCriacao ? new Date(data.dataCriacao).toISOString() : new Date().toISOString());

  return {
    id,
    orderNumber,
    customerName,
    customerPhone,
    services,
    totalAmount: Number(data.totalAmount || data.valorTotal || data.valor || 0),
    paidAmount: Number(data.paidAmount || data.valorPago || data.entrada || 0),
    isFullyPaid: Boolean(data.isFullyPaid !== undefined ? data.isFullyPaid : data.pago),
    deliveryDate: data.deliveryDate || data.dataEntrega || '',
    photoUrl: data.photoUrl || data.foto || (Array.isArray(data.photos) && data.photos[0]) || '/apple-touch-icon.png',
    photos: Array.isArray(data.photos) ? data.photos : (data.photoUrl ? [data.photoUrl] : []),
    status,
    createdAt,
    completedAt: data.completedAt || data.dataPronta,
    deliveredAt: data.deliveredAt || data.dataEntregue,
    createdBy: data.createdBy || 'LOJA',
    updatedAt: data.updatedAt || createdAt,
  };
}

/**
 * Inicializa o Firebase exatamente uma única vez
 */
export function initFirebase(): { app: FirebaseApp | null; db: Firestore | null } {
  if (firestoreDb) {
    return { app: firebaseApp, db: firestoreDb };
  }

  if (!isFirebaseConfigured()) {
    return { app: null, db: null };
  }

  const config = getFirebaseConfig();

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }

    firestoreDb = getFirestore(firebaseApp);
    console.info(`[Firebase] Conectado ao Firestore. Coleção: ${FIRESTORE_COLLECTION}`);
  } catch (err) {
    console.error('[Firebase] Erro ao conectar Firestore:', err);
    firebaseApp = null;
    firestoreDb = null;
  }

  return { app: firebaseApp, db: firestoreDb };
}

export function getDb(): Firestore | null {
  if (!firestoreDb) {
    initFirebase();
  }
  return firestoreDb;
}

export function isFirebaseActive(): boolean {
  return Boolean(getDb());
}

/**
 * Busca todos os pedidos diretamente de pedidosfronteira no Firestore
 */
export async function fetchAllOrdersFromFirestore(): Promise<Order[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const ordersCol = collection(db, FIRESTORE_COLLECTION);
    const snapshot = await getDocs(ordersCol);
    const orders: Order[] = [];
    snapshot.forEach((d) => {
      orders.push(mapDocToOrder(d.id, d.data()));
    });
    // Ordenar em memória pelos mais recentes
    orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    triggerPermissionError(false);
    return orders;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message || '').includes('insufficient permissions')) {
      triggerPermissionError(true);
      console.warn('[Firestore] Permissões insuficientes para ler a coleção pedidosfronteira. Publique as regras no Firebase Console.');
    } else {
      console.error('[Firestore] Erro ao buscar pedidosfronteira:', err);
    }
    return [];
  }
}

/**
 * Grava um novo pedido diretamente na coleção pedidosfronteira no Firestore
 * Utiliza addDoc() para gerar o ID oficial único do Firestore.
 */
export async function createOrderInFirestore(orderData: Omit<Order, 'id'>): Promise<Order> {
  const db = getDb();
  if (!db) {
    throw new Error('Firestore não está inicializado.');
  }

  const colRef = collection(db, FIRESTORE_COLLECTION);
  const cleanData = JSON.parse(JSON.stringify(orderData));
  const docRef = await addDoc(colRef, cleanData);

  return {
    ...orderData,
    id: docRef.id,
  };
}

/**
 * Atualiza campos de um pedido diretamente em pedidosfronteira
 */
export async function updateOrderInFirestore(orderId: string, orderData: Partial<Order>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
  const cleanData = JSON.parse(JSON.stringify(orderData));
  // Remover o campo id para não duplicar no corpo do documento
  delete cleanData.id;

  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Atualiza status para PRONTA diretamente em pedidosfronteira
 */
export async function updateOrderReadyInFirestore(orderId: string, completedAt: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
  await updateDoc(docRef, {
    status: 'PRONTA',
    completedAt,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Atualiza status para ENTREGUE diretamente em pedidosfronteira
 */
export async function updateOrderDeliveredInFirestore(orderId: string, deliveredAt: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
  await updateDoc(docRef, {
    status: 'ENTREGUE',
    deliveredAt,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Exclui um pedido diretamente em pedidosfronteira
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, FIRESTORE_COLLECTION, orderId);
  await deleteDoc(docRef);
}

export interface FirestoreOrderChange {
  type: 'added' | 'modified' | 'removed';
  order: Order;
  oldStatus?: OrderStatus;
  hasPendingWrites: boolean;
  isInitial: boolean;
}

/**
 * Listener oficial em tempo real com onSnapshot() na coleção pedidosfronteira.
 * Qualquer aparelho (celular Android, iPhone, tablet ou PC) que fizer alteração
 * notifica todos os outros aparelhos imediatamente através das mudanças reais (docChanges).
 */
export function subscribeFirestoreOrders(
  onOrdersUpdated: (orders: Order[], changes: FirestoreOrderChange[], isInitial: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getDb();
  if (!db) return null;

  try {
    const ordersCol = collection(db, FIRESTORE_COLLECTION);
    let isInitialSnapshot = true;
    const knownOrdersMap = new Map<string, Order>();

    const unsubscribe = onSnapshot(
      ordersCol,
      { includeMetadataChanges: true },
      (snapshot) => {
        const orders: Order[] = [];
        const changes: FirestoreOrderChange[] = [];

        snapshot.forEach((d) => {
          orders.push(mapDocToOrder(d.id, d.data()));
        });
        // Ordena em memória pelos mais recentes
        orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        snapshot.docChanges().forEach((change) => {
          const order = mapDocToOrder(change.doc.id, change.doc.data());
          const previous = knownOrdersMap.get(order.id);

          changes.push({
            type: change.type,
            order,
            oldStatus: previous?.status,
            hasPendingWrites: change.doc.metadata.hasPendingWrites,
            isInitial: isInitialSnapshot,
          });

          if (change.type === 'removed') {
            knownOrdersMap.delete(order.id);
          } else {
            knownOrdersMap.set(order.id, order);
          }
        });

        const wasInitial = isInitialSnapshot;
        isInitialSnapshot = false;

        triggerPermissionError(false);
        onOrdersUpdated(orders, changes, wasInitial);
      },
      (error: any) => {
        if (error?.code === 'permission-denied' || String(error?.message || '').includes('insufficient permissions')) {
          triggerPermissionError(true);
          console.warn('[Firestore] Permissões insuficientes no listener em tempo real. Publique as regras no Firebase Console.');
        } else {
          console.error('[Firestore] Erro no listener pedidosfronteira:', error);
        }
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('[Firestore] Falha ao assinar pedidosfronteira:', err);
    return null;
  }
}


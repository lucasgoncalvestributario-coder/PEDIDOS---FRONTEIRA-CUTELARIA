import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseConfig, isFirebaseConfigured } from './firebaseConfig';
import { Order } from '../types';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let isInitAttempted = false;

export function initFirebase(): { app: FirebaseApp | null; db: Firestore | null } {
  if (isInitAttempted) {
    return { app: firebaseApp, db: firestoreDb };
  }
  isInitAttempted = true;

  if (!isFirebaseConfigured()) {
    console.info('[Firebase] Configuração não fornecida. Operando em modo offline/local.');
    return { app: null, db: null };
  }

  const config = getFirebaseConfig();

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }

    // Inicialização do Firestore com cache persistente multi-abas (IndexedDB)
    // Minimiza leituras ao extremo: dados já carregados vêm do cache local
    // e o servidor só envia deltas/alterações pontuais.
    try {
      firestoreDb = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      console.info('[Firebase] Firestore inicializado com cache persistente multi-abas.');
    } catch {
      // Caso já tenha sido inicializado
      firestoreDb = getFirestore(firebaseApp);
    }
  } catch (err) {
    console.error('[Firebase] Erro ao inicializar:', err);
    firebaseApp = null;
    firestoreDb = null;
  }

  return { app: firebaseApp, db: firestoreDb };
}

export function getDb(): Firestore | null {
  if (!firestoreDb && !isInitAttempted) {
    initFirebase();
  }
  return firestoreDb;
}

export function isFirebaseActive(): boolean {
  return Boolean(getDb());
}

/**
 * Salva ou atualiza um pedido no Firestore
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, 'orders', order.id);
  // Remove campos undefined para evitar erros no Firestore
  const cleanOrder = JSON.parse(JSON.stringify(order));
  await setDoc(docRef, cleanOrder, { merge: true });
}

/**
 * Atualiza status para PRONTA no Firestore
 */
export async function updateOrderReadyInFirestore(orderId: string, completedAt: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, {
    status: 'PRONTA',
    completedAt,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Atualiza status para ENTREGUE no Firestore
 */
export async function updateOrderDeliveredInFirestore(orderId: string, deliveredAt: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, {
    status: 'ENTREGUE',
    deliveredAt,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Ouve em tempo real as atualizações com consulta ordenada e limite
 * para economizar leituras e manter todos os celulares sincronizados.
 */
export function subscribeFirestoreOrders(
  onOrdersUpdated: (orders: Order[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getDb();
  if (!db) return null;

  try {
    const ordersCol = collection(db, 'orders');
    // Consulta otimizada com limite de 150 pedidos recentes para evitar leituras desnecessárias
    const q = query(ordersCol, orderBy('orderNumber', 'desc'), limit(150));

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Order;
          orders.push({
            ...data,
            id: d.id,
          });
        });
        onOrdersUpdated(orders);
      },
      (error) => {
        console.error('[Firebase] Erro no listener em tempo real:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('[Firebase] Falha ao assinar Firestore:', err);
    return null;
  }
}

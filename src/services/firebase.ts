import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseConfig, isFirebaseConfigured } from './firebaseConfig';
import { Order } from '../types';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let isInitAttempted = false;

/**
 * Inicializa o Firebase exatamente uma única vez utilizando as variáveis de ambiente VITE_*
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
    isInitAttempted = true;
    console.info('[Firebase] Firestore conectado com sucesso como banco central.');
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
 * Busca todos os pedidos diretamente do Firestore (banco central)
 */
export async function fetchAllOrdersFromFirestore(): Promise<Order[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const orders: Order[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as Order;
      orders.push({
        ...data,
        id: d.id,
      });
    });
    return orders;
  } catch (err) {
    console.error('[Firestore] Erro ao buscar pedidos:', err);
    return [];
  }
}

/**
 * Salva ou atualiza um pedido no Firestore central
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error('Firestore não está inicializado. Verifique as variáveis VITE_FIREBASE_* no Netlify.');
  }

  const docRef = doc(db, 'orders', order.id);
  // Remove campos undefined para respeitar a especificação do Firestore
  const cleanOrder = JSON.parse(JSON.stringify(order));
  await setDoc(docRef, cleanOrder, { merge: true });
}

/**
 * Atualiza status para PRONTA no Firestore central
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
 * Atualiza status para ENTREGUE no Firestore central
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
 * Exclui um pedido do Firestore central se necessário
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const docRef = doc(db, 'orders', orderId);
  await deleteDoc(docRef);
}

/**
 * Listener em tempo real via onSnapshot():
 * Sempre que qualquer aparelho (celular, tablet ou PC) criar,
 * alterar ou entregar um pedido, todos os outros aparelhos conectados
 * recebem a atualização instantaneamente.
 */
export function subscribeFirestoreOrders(
  onOrdersUpdated: (orders: Order[]) => void,
  onError?: (err: Error) => void
): Unsubscribe | null {
  const db = getDb();
  if (!db) return null;

  try {
    const ordersCol = collection(db, 'orders');
    // Ordenação garantindo que os pedidos mais recentes apareçam no topo
    const q = query(ordersCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
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


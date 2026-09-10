import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Order } from './types';
import {
  fetchOrders,
  createOrder,
  markOrderReady,
  deliverOrder,
  deleteOrder,
  subscribeToRealTimeEvents,
} from './services/api';
import { onPermissionErrorChange } from './services/firebase';
import { playNotificationChime } from './utils/dateUtils';
import {
  notifyNewOrder,
  notifyOrderReady,
  requestNotificationPermission,
} from './services/notifications';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { LojaView } from './components/LojaView';
import { CuteleiroView } from './components/CuteleiroView';
import { NovoPedidoModal } from './components/NovoPedidoModal';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { InstallAppModal } from './components/InstallAppModal';
import { NotificationModal } from './components/NotificationModal';

function getInitialRole(): UserRole | null {
  try {
    if (typeof window === 'undefined') return null;

    // 1. Check URL path (e.g. /loja or /cuteleiro)
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('/loja')) return 'LOJA';
    if (pathname.includes('/cuteleiro')) return 'CUTELEIRO';

    // 2. Check query parameter (e.g. ?role=LOJA)
    const search = new URLSearchParams(window.location.search);
    const roleParam = search.get('role')?.toUpperCase();
    if (roleParam === 'LOJA' || roleParam === 'CUTELEIRO') {
      return roleParam as UserRole;
    }

    // 3. Check sessionStorage or localStorage
    const saved = sessionStorage.getItem('cutelaria_role') || localStorage.getItem('cutelaria_role');
    if (saved === 'LOJA' || saved === 'CUTELEIRO') {
      return saved as UserRole;
    }
  } catch {
    // Ignore storage/url errors
  }
  return null;
}

export default function App() {
  const [role, setRole] = useState<UserRole | null>(() => getInitialRole());
  const [orders, setOrders] = useState<Order[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);

  // Modals & Popups
  const [isNovoPedidoOpen, setIsNovoPedidoOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [photoModalList, setPhotoModalList] = useState<string[]>([]);
  const [photoModalIndex, setPhotoModalIndex] = useState<number>(0);
  const [photoCustomerName, setPhotoCustomerName] = useState<string | undefined>(undefined);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [readyOrderAlert, setReadyOrderAlert] = useState<Order | null>(null);

  // Escuta status de permissão das Regras do Firebase
  useEffect(() => {
    return onPermissionErrorChange((isError) => {
      setHasPermissionError(isError);
    });
  }, []);

  // Set role, persist in session & sync with URL
  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    try {
      sessionStorage.setItem('cutelaria_role', newRole);
      localStorage.setItem('cutelaria_role', newRole);
      const targetPath = newRole === 'LOJA' ? '/loja' : '/cuteleiro';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ role: newRole }, '', targetPath);
      }
    } catch {
      // ignore
    }
  };

  const handleSwitchRole = () => {
    const nextRole = role === 'LOJA' ? 'CUTELEIRO' : 'LOJA';
    handleSelectRole(nextRole);
  };

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setRole(getInitialRole());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load initial orders
  const loadInitialData = useCallback(async () => {
    try {
      const fetchedOrders = await fetchOrders();
      setOrders(fetchedOrders);
    } catch (err) {
      console.error('Falha ao buscar dados iniciais:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Re-sync when user returns to the app tab / unlocks phone screen
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        loadInitialData();
      }
    };

    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    return () => {
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [loadInitialData]);

  // Subscribe to real-time events (SSE / BroadcastChannel)
  useEffect(() => {
    const unsubscribe = subscribeToRealTimeEvents((event) => {
      if (event.type === 'CONNECTED') {
        setIsConnected(true);
      }

      if (event.type === 'ORDERS_SYNCED') {
        if (event.orders && Array.isArray(event.orders)) {
          setOrders(event.orders);
        } else {
          loadInitialData();
        }
      }

      if (event.type === 'ORDER_CREATED' && event.order) {
        const createdOrder = event.order;
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === createdOrder.id);
          if (exists) return prev;
          return [createdOrder, ...prev];
        });

        // Trigger notification sound & banner for cuteleiro
        playNotificationChime('new_order');
        setNewOrderAlert(createdOrder);

        // Dispara notificação nativa fixa no sistema (Android/iOS/PC) com logo oficial
        notifyNewOrder(createdOrder);
      }

      if (event.type === 'ORDER_READY' && event.order) {
        const readyOrder = event.order;
        setOrders((prev) =>
          prev.map((o) => (o.id === readyOrder.id ? readyOrder : o))
        );
        playNotificationChime('ready');
        setReadyOrderAlert(readyOrder);

        // Dispara notificação nativa para a loja saber que está pronto
        notifyOrderReady(readyOrder);
      }

      if (event.type === 'ORDER_DELIVERED' && event.order) {
        const delivered = event.order;
        setOrders((prev) =>
          prev.map((o) => (o.id === delivered.id ? delivered : o))
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadInitialData]);

  // Request browser notification permission once
  useEffect(() => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  // Create order handler
  const handleCreateOrder = async (orderData: Partial<Order>) => {
    const newOrder = await createOrder({
      ...orderData,
      createdBy: 'LOJA',
    });
    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
  };

  // Mark order ready handler (Cuteleiro)
  const handleMarkOrderReady = async (orderId: string) => {
    const updated = await markOrderReady(orderId);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  // Deliver order handler (Loja)
  const handleDeliverOrder = async (orderId: string) => {
    const updated = await deliverOrder(orderId);
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  // Delete order handler (Cuteleiro or Loja)
  const handleDeleteOrder = async (orderId: string) => {
    await deleteOrder(orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleOpenPhoto = (photos: string[] | string, initialIndex = 0, customerName?: string) => {
    const list = Array.isArray(photos) ? photos : [photos];
    setPhotoModalList(list);
    setPhotoModalIndex(initialIndex);
    setPhotoCustomerName(customerName);
  };

  // If no role chosen yet, show Login Screen with 2 HUGE buttons
  if (!role) {
    return <LoginScreen onSelectRole={handleSelectRole} />;
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col antialiased text-stone-900 selection:bg-amber-300 selection:text-stone-900">
      {/* Header with Exact Logo and Title */}
      <Header
        currentRole={role}
        onSwitchRole={handleSwitchRole}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        isConnected={isConnected}
      />

      {/* Alerta amigável de regras do Firebase se as permissões estiverem bloqueadas */}
      {hasPermissionError && (
        <div className="max-w-2xl mx-auto w-full px-3 pt-3">
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-500 shadow-md text-stone-900 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <h4 className="font-black text-sm uppercase text-amber-950">
                  Ação no Firebase Console (Permissão Bloqueada)
                </h4>
              </div>
              <button
                onClick={() => setHasPermissionError(false)}
                className="text-stone-400 hover:text-stone-700 text-sm font-bold px-1.5 py-0.5 rounded cursor-pointer"
                title="Dispensar aviso"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed">
              O Firebase retornou <strong>Missing or insufficient permissions</strong>. Para liberar o acesso aos pedidos na coleção <strong>pedidosfronteira</strong>:
              acesse o <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="font-bold underline text-amber-900">Firebase Console</a> &gt; <strong>Firestore Database</strong> &gt; aba <strong>Regras (Rules)</strong>, cole a regra abaixo e clique no botão azul <strong>Publicar</strong>.
            </p>
            <div className="bg-stone-900 text-amber-300 p-2.5 rounded-xl font-mono text-[11px] flex items-center justify-between gap-2">
              <code className="truncate">match /&#123;document=**&#125; &#123; allow read, write: if true; &#125;</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}"
                  );
                  setCopiedRule(true);
                  setTimeout(() => setCopiedRule(false), 3000);
                }}
                className="flex-shrink-0 px-2.5 py-1 bg-amber-500 text-stone-950 font-black rounded-lg text-xs hover:bg-amber-400 active:scale-95 transition-all cursor-pointer"
              >
                {copiedRule ? '✓ COPIADO!' : 'COPIAR REGRA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Faca Pronta para a Loja */}
      {role === 'LOJA' && readyOrderAlert && (
        <div className="max-w-3xl mx-auto w-full px-4 pt-3">
          <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center justify-between gap-3 border-2 border-emerald-400 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗡️</span>
              <div>
                <h4 className="font-black text-sm uppercase tracking-tight">Faca Pronta na Bancada!</h4>
                <p className="text-xs text-emerald-100 font-medium">
                  Pedido #{readyOrderAlert.orderNumber} ({readyOrderAlert.customerName}) foi marcado como pronto pelo cuteleiro.
                </p>
              </div>
            </div>
            <button
              onClick={() => setReadyOrderAlert(null)}
              className="px-3 py-1.5 bg-white text-emerald-950 font-black text-xs uppercase rounded-xl hover:bg-emerald-50 cursor-pointer flex-shrink-0 shadow"
            >
              OK, ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* Main View Container */}
      <main className="flex-1">
        {role === 'LOJA' ? (
          <LojaView
            orders={orders}
            onOpenNovoPedido={() => setIsNovoPedidoOpen(true)}
            onDeliverOrder={handleDeliverOrder}
            onDeleteOrder={handleDeleteOrder}
            onOpenPhoto={handleOpenPhoto}
          />
        ) : (
          <CuteleiroView
            orders={orders}
            onMarkOrderReady={handleMarkOrderReady}
            onDeleteOrder={handleDeleteOrder}
            onOpenPhoto={handleOpenPhoto}
            newOrderAlert={newOrderAlert}
            onDismissAlert={() => setNewOrderAlert(null)}
          />
        )}
      </main>

      {/* NOVO PEDIDO MODAL */}
      <NovoPedidoModal
        isOpen={isNovoPedidoOpen}
        onClose={() => setIsNovoPedidoOpen(false)}
        onSubmitOrder={handleCreateOrder}
      />

      {/* PHOTO VIEWER MODAL */}
      <PhotoViewerModal
        photos={photoModalList}
        initialIndex={photoModalIndex}
        customerName={photoCustomerName}
        onClose={() => {
          setPhotoModalList([]);
          setPhotoModalIndex(0);
          setPhotoCustomerName(undefined);
        }}
      />

      {/* INSTALL APP MODAL */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* NOTIFICATION PERMISSION MODAL */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onPermissionUpdated={() => {}}
      />
    </div>
  );
}


import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Order } from './types';
import {
  fetchOrders,
  createOrder,
  markOrderReady,
  deliverOrder,
  subscribeToRealTimeEvents,
} from './services/api';
import { playNotificationChime } from './utils/dateUtils';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { LojaView } from './components/LojaView';
import { CuteleiroView } from './components/CuteleiroView';
import { NovoPedidoModal } from './components/NovoPedidoModal';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { InstallAppModal } from './components/InstallAppModal';

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
  const [isNovoPedidoOpen, setIsNovoPedidoOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [photoModalList, setPhotoModalList] = useState<string[]>([]);
  const [photoModalIndex, setPhotoModalIndex] = useState<number>(0);
  const [photoCustomerName, setPhotoCustomerName] = useState<string | undefined>(undefined);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);

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
        loadInitialData();
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

        // Native browser notification if allowed
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('NOVO PEDIDO RECEBIDO', {
              body: `Faca de ${createdOrder.customerName} enviada pela Loja!`,
              icon: '/apple-touch-icon.png',
            });
          } catch {
            // ignore
          }
        }
      }

      if (event.type === 'ORDER_READY' && event.order) {
        const readyOrder = event.order;
        setOrders((prev) =>
          prev.map((o) => (o.id === readyOrder.id ? readyOrder : o))
        );
        playNotificationChime('ready');
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
        isConnected={isConnected}
      />

      {/* Main View Container */}
      <main className="flex-1">
        {role === 'LOJA' ? (
          <LojaView
            orders={orders}
            onOpenNovoPedido={() => setIsNovoPedidoOpen(true)}
            onDeliverOrder={handleDeliverOrder}
            onOpenPhoto={handleOpenPhoto}
          />
        ) : (
          <CuteleiroView
            orders={orders}
            onMarkOrderReady={handleMarkOrderReady}
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
    </div>
  );
}

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

export default function App() {
  const [role, setRole] = useState<UserRole | null>(() => {
    // Check if role was previously selected in this browser session
    const saved = sessionStorage.getItem('cutelaria_role') as UserRole | null;
    return saved === 'LOJA' || saved === 'CUTELEIRO' ? saved : null;
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isNovoPedidoOpen, setIsNovoPedidoOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [photoModalList, setPhotoModalList] = useState<string[]>([]);
  const [photoModalIndex, setPhotoModalIndex] = useState<number>(0);
  const [photoCustomerName, setPhotoCustomerName] = useState<string | undefined>(undefined);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);

  // Set role and persist in session
  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    sessionStorage.setItem('cutelaria_role', newRole);
  };

  const handleSwitchRole = () => {
    const nextRole = role === 'LOJA' ? 'CUTELEIRO' : 'LOJA';
    handleSelectRole(nextRole);
  };

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

  // Subscribe to real-time events (SSE)
  useEffect(() => {
    const unsubscribe = subscribeToRealTimeEvents((event) => {
      console.log('[REAL-TIME EVENT RECEBIDO]:', event);

      if (event.type === 'CONNECTED') {
        setIsConnected(true);
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
              icon: '/logo.png',
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
  }, []);

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
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

import { Order } from '../types';
import { playNotificationChime } from '../utils/dateUtils';

const NOTIF_STORAGE_KEY = 'cutelaria_notifications_enabled_v2';
export const CUTELARIA_LOGO_BLACK_BG = '/pwa-192x192.png';

/**
 * Check if Web Notifications are supported in this browser
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Detect iOS (Safari / WebKit)
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Check if PWA is installed / standalone
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone)
  );
}

/**
 * Check current notification permission with persistent fallback
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  const permission = Notification.permission;
  if (permission === 'granted') {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  }
  return permission;
}

/**
 * Has user previously enabled notifications in localStorage
 */
export function isNotificationPersistedActive(): boolean {
  try {
    return localStorage.getItem(NOTIF_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Request notification permission and automatically send confirmation notification
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        localStorage.setItem(NOTIF_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      // Send the official confirmation notification
      await sendConfirmationNotification();
    }
    return permission;
  } catch (err) {
    console.warn('[Notifications] Erro ao solicitar permissão:', err);
    return Notification.permission;
  }
}

export interface SystemNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  orderId?: string;
}

/**
 * Envia notificação nativa para Android, iOS e Desktop
 * com requireInteraction: true para ficar FIXA na barra de notificações
 * e emblema oficial da Fronteira Cutelaria com fundo preto.
 */
export async function sendSystemNotification({
  title,
  body,
  tag = 'cutelaria-alerta',
  orderId,
}: SystemNotificationOptions): Promise<boolean> {
  // 1. Toca som no dispositivo
  playNotificationChime(tag.includes('pronto') ? 'ready' : 'new_order');

  // 2. Vibração para celulares
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }

  // Se o navegador não suportar ou permissão não concedida, para por aqui
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: CUTELARIA_LOGO_BLACK_BG,
    badge: CUTELARIA_LOGO_BLACK_BG,
    tag,
    requireInteraction: true, // Fica FIXO na barra de notificação até o usuário tocar ou descartar
    renotify: true,
    data: {
      url: window.location.origin,
      orderId,
      timestamp: Date.now(),
    },
  };

  // Tenta pelo Service Worker (Melhor para Android e iOS PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    } catch (swError) {
      console.warn('[Notifications] Erro ao enviar via Service Worker:', swError);
    }
  }

  // Fallback: API Notification padrão
  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.warn('[Notifications] Erro ao criar notificação padrão:', err);
    return false;
  }
}

/**
 * Notificação de Confirmação Oficial disparada assim que o usuário ativa
 */
export async function sendConfirmationNotification(): Promise<boolean> {
  return sendSystemNotification({
    title: 'Fronteira Cutelaria',
    body: '🔔 Notificações ativadas com sucesso! Você receberá avisos fixos na sua barra de notificação sempre que houver novo pedido ou lâmina pronta.',
    tag: 'cutelaria-confirmacao-ativada',
  });
}

/**
 * Notifica novo pedido recebido
 */
export async function notifyNewOrder(order: Order): Promise<boolean> {
  const serviceSummary = order.services && order.services.length > 0
    ? order.services.map((s) => s.name).join(', ')
    : 'Serviço de Cutelaria';

  return sendSystemNotification({
    title: `Fronteira Cutelaria - Novo Pedido #${order.orderNumber}!`,
    body: `Cliente: ${order.customerName} | Serviços: ${serviceSummary}`,
    tag: `pedido-novo-${order.id}`,
    orderId: order.id,
  });
}

/**
 * Notifica lâmina pronta para entrega
 */
export async function notifyOrderReady(order: Order): Promise<boolean> {
  const serviceSummary = order.services && order.services.length > 0
    ? order.services.map((s) => s.name).join(', ')
    : 'Lâmina';

  return sendSystemNotification({
    title: `Fronteira Cutelaria - Lâmina Pronta #${order.orderNumber}!`,
    body: `A peça de ${order.customerName} (${serviceSummary}) está pronta para retirada na loja!`,
    tag: `pedido-pronto-${order.id}`,
    orderId: order.id,
  });
}


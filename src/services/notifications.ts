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
export async function requestNotificationPermission(role?: string): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        localStorage.setItem(NOTIF_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      // Ativa inscrição Push no servidor para receber notificações mesmo com o app fechado
      registerWebPushSubscription(role).catch((err) =>
        console.warn('[Push] Falha ao registrar Web Push ao conceder permissão:', err)
      );

      // Send the official confirmation notification
      await sendConfirmationNotification();
    }
    return permission;
  } catch (err) {
    console.warn('[Notifications] Erro ao solicitar permissão:', err);
    return Notification.permission;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registra o dispositivo no serviço de Web Push (PushManager + VAPID).
 * Permite que notificações cheguem mesmo quando o app está fechado, tela bloqueada ou em segundo plano.
 */
export async function registerWebPushSubscription(role?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = await getActiveServiceWorkerRegistration();
    if (!reg || !('pushManager' in reg)) {
      console.warn('[Push] PushManager não suportado neste navegador.');
      return false;
    }

    // 1. Busca chave pública VAPID do servidor
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) {
      console.warn('[Push] Não foi possível obter chave pública VAPID.');
      return false;
    }
    const { publicKey } = await res.json();
    if (!publicKey) {
      return false;
    }

    // 2. Verifica se já existe inscrição ativa
    let subscription = await reg.pushManager.getSubscription();

    // 3. Se não houver, inscreve no PushManager
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // 4. Envia inscrição ao servidor para armazenamento persistente
    const subJson = subscription.toJSON();
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subJson,
        role: role || 'TODOS',
      }),
    });

    if (saveRes.ok) {
      console.info('[Push] Dispositivo inscrito com sucesso para notificações em segundo plano e com app fechado!');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Push] Erro ao registrar inscrição Web Push:', err);
    return false;
  }
}

/**
 * Dispara notificação push via servidor para todos os celulares e computadores registrados,
 * mesmo que estejam com o navegador fechado ou em segundo plano.
 */
export async function triggerServerPush({
  title,
  body,
  tag,
  orderId,
  role,
}: SystemNotificationOptions & { role?: string }): Promise<void> {
  try {
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        tag,
        orderId,
        role: role || 'TODOS',
        url: '/',
      }),
    });
  } catch (err) {
    console.warn('[Push] Erro ao solicitar push no servidor:', err);
  }
}

export interface SystemNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  orderId?: string;
}

/**
 * Localiza ou inicializa a registration ativa do Service Worker
 * com tolerância estendida para celulares Android e iOS PWA.
 */
export async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // 1. Tenta getRegistration atual diretamente (resposta instantânea se já ativo)
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }

    // 2. Aguarda ready com timeout generoso (até 2500ms para dispositivos móveis)
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (readyReg) {
      return readyReg;
    }

    // 3. Tenta lista completa de registrations
    const all = await navigator.serviceWorker.getRegistrations();
    if (all && all.length > 0) {
      return all[0];
    }

    // 4. Se não havia SW registrado, registra imediatamente
    const freshReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return freshReg;
  } catch (err) {
    console.warn('[Notifications] Falha ao obter Service Worker registration:', err);
    return null;
  }
}

/**
 * Envia notificação nativa para Android, iOS (PWA na Tela de Início) e Desktop
 * com som, vibração e emblema oficial da Fronteira Cutelaria com fundo preto.
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
      navigator.vibrate([250, 100, 250, 100, 350]);
    } catch {
      // ignore
    }
  }

  // Se o navegador não suportar ou permissão não concedida, para por aqui
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const isApple = isIOS();
  const notificationOptions: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    icon: CUTELARIA_LOGO_BLACK_BG,
    badge: CUTELARIA_LOGO_BLACK_BG,
    tag,
    vibrate: [250, 100, 250, 100, 350],
    data: {
      url: window.location.origin,
      orderId,
      timestamp: Date.now(),
    },
  };

  // requireInteraction e renotify são aplicados onde há suporte nativo (Android e Desktop)
  if (!isApple) {
    (notificationOptions as any).requireInteraction = true;
    notificationOptions.renotify = true;
  }

  let shown = false;

  // 1. Tenta através do Service Worker (OBRIGATÓRIO em Android Chrome e iOS PWA)
  const reg = await getActiveServiceWorkerRegistration();
  if (reg && typeof reg.showNotification === 'function') {
    try {
      await reg.showNotification(title, notificationOptions);
      shown = true;
    } catch (swError) {
      console.warn('[Notifications] Erro em reg.showNotification:', swError);
    }
  }

  // 2. Tenta via postMessage para o Service Worker ativo caso o método direto tenha oscilado
  if (!shown && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: notificationOptions,
      });
      shown = true;
    } catch (msgErr) {
      console.warn('[Notifications] Erro ao postar mensagem no SW controller:', msgErr);
    }
  }

  // 3. Fallback EXCLUSIVO para computadores Desktop (pois celulares bloqueiam new Notification com Illegal constructor)
  if (!shown && !isApple && typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try {
      const notif = new Notification(title, notificationOptions);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      shown = true;
    } catch (err) {
      console.warn('[Notifications] Erro no fallback desktop:', err);
    }
  }

  return shown;
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
 * Notificação de teste simulando Novo Pedido
 */
export async function sendTestNewOrderNotification(): Promise<boolean> {
  const local = await sendSystemNotification({
    title: 'Fronteira Cutelaria - Novo Pedido #108!',
    body: 'Cliente: TESTE CELULAR | Serviços: Afiação Especial, Polimento',
    tag: 'pedido-novo-teste',
  });

  triggerServerPush({
    title: 'Fronteira Cutelaria - Novo Pedido #108!',
    body: 'Cliente: TESTE CELULAR | Serviços: Afiação Especial, Polimento',
    tag: 'pedido-novo-teste',
  });

  return local;
}

/**
 * Notificação de teste simulando Lâmina Pronta
 */
export async function sendTestReadyNotification(): Promise<boolean> {
  const local = await sendSystemNotification({
    title: 'Fronteira Cutelaria - Lâmina Pronta #108!',
    body: 'A peça de TESTE CELULAR (Afiação Especial) está pronta para retirada na loja!',
    tag: 'pedido-pronto-teste',
  });

  triggerServerPush({
    title: 'Fronteira Cutelaria - Lâmina Pronta #108!',
    body: 'A peça de TESTE CELULAR (Afiação Especial) está pronta para retirada na loja!',
    tag: 'pedido-pronto-teste',
  });

  return local;
}

/**
 * Notifica novo pedido recebido
 */
export async function notifyNewOrder(order: Order): Promise<boolean> {
  const serviceSummary = order.services && order.services.length > 0
    ? order.services.map((s) => s.name).join(', ')
    : 'Serviço de Cutelaria';

  const localShown = await sendSystemNotification({
    title: `Fronteira Cutelaria - Novo Pedido #${order.orderNumber}!`,
    body: `Cliente: ${order.customerName} | Serviços: ${serviceSummary}`,
    tag: `pedido-novo-${order.id}`,
    orderId: order.id,
  });

  // Dispara Push via servidor para despertar os celulares mesmo com app fechado
  triggerServerPush({
    title: `Fronteira Cutelaria - Novo Pedido #${order.orderNumber}!`,
    body: `Cliente: ${order.customerName} | Serviços: ${serviceSummary}`,
    tag: `pedido-novo-${order.id}`,
    orderId: order.id,
    role: 'CUTELEIRO',
  });

  return localShown;
}

/**
 * Notifica lâmina pronta para entrega
 */
export async function notifyOrderReady(order: Order): Promise<boolean> {
  const serviceSummary = order.services && order.services.length > 0
    ? order.services.map((s) => s.name).join(', ')
    : 'Lâmina';

  const localShown = await sendSystemNotification({
    title: `Fronteira Cutelaria - Lâmina Pronta #${order.orderNumber}!`,
    body: `A peça de ${order.customerName} (${serviceSummary}) está pronta para retirada na loja!`,
    tag: `pedido-pronto-${order.id}`,
    orderId: order.id,
  });

  // Dispara Push via servidor para despertar os celulares mesmo com app fechado
  triggerServerPush({
    title: `Fronteira Cutelaria - Lâmina Pronta #${order.orderNumber}!`,
    body: `A peça de ${order.customerName} (${serviceSummary}) está pronta para retirada na loja!`,
    tag: `pedido-pronto-${order.id}`,
    orderId: order.id,
    role: 'LOJA',
  });

  return localShown;
}


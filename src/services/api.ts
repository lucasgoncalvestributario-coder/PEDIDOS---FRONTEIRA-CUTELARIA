import { Order, IntegrationLog } from '../types';

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
  const res = await fetch('/api/orders');
  if (!res.ok) {
    throw new Error('Falha ao carregar pedidos');
  }
  return res.json();
}

export async function createOrder(orderData: Partial<Order>): Promise<Order> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao criar pedido' }));
    throw new Error(err.error || 'Falha ao criar pedido');
  }
  return res.json();
}

export async function markOrderReady(orderId: string): Promise<Order> {
  const res = await fetch(`/api/orders/${orderId}/ready`, {
    method: 'PUT',
  });
  if (!res.ok) {
    throw new Error('Falha ao marcar como pronta');
  }
  return res.json();
}

export async function deliverOrder(orderId: string): Promise<Order> {
  const res = await fetch(`/api/orders/${orderId}/deliver`, {
    method: 'PUT',
  });
  if (!res.ok) {
    throw new Error('Falha ao dar baixa');
  }
  return res.json();
}

export async function uploadKnifePhoto(base64Data: string): Promise<string> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
  } catch (err) {
    console.warn('Upload endpoint fallback to base64 data:', err);
  }
  return base64Data;
}

export async function fetchLogs(): Promise<IntegrationLog[]> {
  try {
    const res = await fetch('/api/logs');
    if (res.ok) {
      return res.json();
    }
  } catch {
    // fallback
  }
  return [];
}

export type RealTimeCallback = (event: {
  type: string;
  order?: Order;
  log?: IntegrationLog;
  message?: string;
}) => void;

export function subscribeToRealTimeEvents(callback: RealTimeCallback): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/events');

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
        }
        if (!isClosed) {
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      console.warn('SSE connection error:', e);
      if (!isClosed) {
        setTimeout(connect, 4000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
    }
  };
}

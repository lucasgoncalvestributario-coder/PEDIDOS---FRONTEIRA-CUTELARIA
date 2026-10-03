import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Body parser with generous limit for knife photos
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Directories for persistence and uploads
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Inicialização de chaves VAPID estáveis para Push Notifications em segundo plano
interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface StoredPushSubscription {
  id: string;
  subscription: webpush.PushSubscription;
  role?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

let vapidKeys: VapidKeys = {
  publicKey: '',
  privateKey: '',
};

function initVapidKeys(): void {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const data = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
      if (data.publicKey && data.privateKey) {
        vapidKeys = data;
      }
    }
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      const generated = webpush.generateVAPIDKeys();
      vapidKeys = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
      };
      fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8');
      console.log('[Push] Novas chaves VAPID geradas e salvas com sucesso.');
    }
    webpush.setVapidDetails(
      'mailto:contato@fronteiracutelaria.com.br',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log('[Push] Sistema VAPID pronto para notificações mesmo com app fechado.');
  } catch (err) {
    console.error('[Push] Erro ao inicializar VAPID:', err);
  }
}

initVapidKeys();

function readPushSubscriptions(): StoredPushSubscription[] {
  try {
    if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writePushSubscriptions(subs: StoredPushSubscription[]): void {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Push] Erro ao salvar push subscriptions:', err);
  }
}

/**
 * Envia notificação Web Push a todos os dispositivos registrados.
 * Essa notificação desperta o Service Worker mesmo com o celular bloqueado ou o navegador fechado!
 */
async function sendPushToAll(payload: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  orderId?: string;
  role?: string;
}): Promise<void> {
  const subs = readPushSubscriptions();
  if (subs.length === 0) {
    return;
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'cutelaria-alerta',
    url: payload.url || '/',
    orderId: payload.orderId,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  });

  const validSubs: StoredPushSubscription[] = [];

  for (const sub of subs) {
    // Se a notificação for direcionada para um papel específico e o dispositivo tiver papel configurado
    if (payload.role && sub.role && sub.role !== 'TODOS' && sub.role !== payload.role) {
      validSubs.push(sub);
      continue;
    }

    try {
      await webpush.sendNotification(sub.subscription, notificationPayload);
      validSubs.push(sub);
    } catch (err: any) {
      // 404 / 410 indica que o usuário desinstalou ou a permissão foi revogada no dispositivo
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        console.log(`[Push] Inscrição expirada removida: ${sub.id}`);
      } else {
        validSubs.push(sub);
      }
    }
  }

  if (validSubs.length !== subs.length) {
    writePushSubscriptions(validSubs);
  }
}

// Ensure public/uploads and public assets are statically served
const PUBLIC_DIR = path.join(process.cwd(), 'public');
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

interface OrderItem {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  services: Array<{
    name: string;
    details?: string;
    notes?: string;
  }>;
  totalAmount: number;
  paidAmount: number;
  isFullyPaid: boolean;
  deliveryDate: string;
  photoUrl: string;
  photos?: string[];
  status: 'PENDENTE' | 'EM PRODUÇÃO' | 'PRONTA' | 'ENTREGUE' | 'ATRASADA';
  createdAt: string;
  completedAt?: string;
  deliveredAt?: string;
  createdBy: string;
  updatedAt: string;
}

interface IntegrationLog {
  id: string;
  timestamp: string;
  source: 'LOJA' | 'CUTELEIRO' | 'GUASQUEIRO' | 'SERVIDOR' | 'SISTEMA';
  action: string;
  details: string;
  orderId?: string;
}

// Initial sample orders if database file is empty
const INITIAL_ORDERS: OrderItem[] = [];

function readOrders(): OrderItem[] {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(INITIAL_ORDERS, null, 2), 'utf-8');
      return INITIAL_ORDERS;
    }
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading orders file:', err);
    return INITIAL_ORDERS;
  }
}

function writeOrders(orders: OrderItem[]): void {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing orders file:', err);
  }
}

function readLogs(): IntegrationLog[] {
  try {
    if (!fs.existsSync(LOGS_FILE)) {
      const initialLogs: IntegrationLog[] = [
        {
          id: 'log-init',
          timestamp: new Date().toISOString(),
          source: 'SERVIDOR',
          action: 'INICIALIZAÇÃO',
          details: 'Banco de dados online centralizado e SSE em tempo real prontos',
        },
      ];
      fs.writeFileSync(LOGS_FILE, JSON.stringify(initialLogs, null, 2), 'utf-8');
      return initialLogs;
    }
    const data = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function addLog(source: IntegrationLog['source'], action: string, details: string, orderId?: string): void {
  try {
    const logs = readLogs();
    const newLog: IntegrationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      source,
      action,
      details,
      orderId,
    };
    logs.unshift(newLog);
    // Keep max 200 logs
    const trimmed = logs.slice(0, 200);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
    // Notify clients about new log
    broadcastSSE({ type: 'LOG_ADDED', log: newLog });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

// Server-Sent Events (SSE) clients registry
const sseClients: Response[] = [];

function broadcastSSE(data: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch {
      // client disconnected
    }
  });
}

// Keep-alive heartbeat every 20 seconds
setInterval(() => {
  broadcastSSE({ type: 'HEARTBEAT', timestamp: new Date().toISOString() });
}, 20000);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', online: true, time: new Date().toISOString() });
});

// SSE endpoint for instant real-time updates
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);
  console.log(`[SSE] Novo cliente conectado em tempo real (Total: ${sseClients.length})`);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Conexão em tempo real estabelecida com sucesso' })}\n\n`);

  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
    console.log(`[SSE] Cliente desconectado (Restantes: ${sseClients.length})`);
  });
});

// List orders
app.get('/api/orders', (req: Request, res: Response) => {
  const orders = readOrders();
  res.json(orders);
});

// Endpoint para obter a chave pública VAPID (para o navegador registrar o PushManager)
app.get('/api/push/vapid-public-key', (req: Request, res: Response) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Endpoint para registrar ou renovar a inscrição de push do dispositivo
app.post('/api/push/subscribe', (req: Request, res: Response) => {
  try {
    const { subscription, role } = req.body;
    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'Inscrição push inválida.' });
      return;
    }

    const subs = readPushSubscriptions();
    const existingIndex = subs.findIndex((s) => s.subscription.endpoint === subscription.endpoint);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      subs[existingIndex].subscription = subscription;
      subs[existingIndex].role = role || subs[existingIndex].role || 'TODOS';
      subs[existingIndex].updatedAt = now;
    } else {
      subs.push({
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        subscription,
        role: role || 'TODOS',
        userAgent: (req.headers['user-agent'] as string) || '',
        createdAt: now,
        updatedAt: now,
      });
    }

    writePushSubscriptions(subs);
    console.log(`[Push] Dispositivo registrado com sucesso. Total de aparelhos com notificações ativas: ${subs.length}`);
    res.status(201).json({ success: true, count: subs.length });
  } catch (err) {
    console.error('[Push] Erro ao salvar inscrição:', err);
    res.status(500).json({ error: 'Erro ao registrar notificação push.' });
  }
});

// Endpoint para desinscrever push
app.post('/api/push/unsubscribe', (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint não fornecido.' });
      return;
    }
    const subs = readPushSubscriptions();
    const filtered = subs.filter((s) => s.subscription.endpoint !== endpoint);
    writePushSubscriptions(filtered);
    res.json({ success: true, count: filtered.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desinscrever.' });
  }
});

// Endpoint para disparar notificações push a partir de qualquer ação do app
app.post('/api/push/notify', async (req: Request, res: Response) => {
  try {
    const { title, body, tag, url, orderId, role } = req.body;
    if (!title || !body) {
      res.status(400).json({ error: 'title e body são obrigatórios.' });
      return;
    }
    await sendPushToAll({ title, body, tag, url, orderId, role });
    res.json({ success: true });
  } catch (err) {
    console.error('[Push] Erro no endpoint /api/push/notify:', err);
    res.status(500).json({ error: 'Erro ao disparar notificação push.' });
  }
});

// Get logs
app.get('/api/logs', (req: Request, res: Response) => {
  const logs = readLogs();
  res.json(logs);
});

// Create new order
app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, services, totalAmount, paidAmount, isFullyPaid, deliveryDate, photoUrl, photos, createdBy } = req.body;

    if (!customerName || !customerPhone || !deliveryDate) {
      res.status(400).json({ error: 'Campos obrigatórios: Nome, Telefone e Data de Entrega.' });
      return;
    }

    const orders = readOrders();
    const highestNum = orders.reduce((max, o) => Math.max(max, o.orderNumber || 0), 100);
    const nextNum = highestNum + 1;

    const photoList: string[] = Array.isArray(photos) && photos.length > 0
      ? photos
      : (photoUrl ? [photoUrl] : []);
    const primaryPhoto = photoList[0] || photoUrl || 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=800&q=80';

    const newOrder: OrderItem = {
      id: `PED-${nextNum}`,
      orderNumber: nextNum,
      customerName: (customerName || '').toUpperCase().trim(),
      customerPhone: customerPhone.trim(),
      services: Array.isArray(services) && services.length > 0 ? services : [{ name: 'AFIAÇÃO' }],
      totalAmount: Number(totalAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      isFullyPaid: Boolean(isFullyPaid),
      deliveryDate,
      photoUrl: primaryPhoto,
      photos: photoList,
      status: 'PENDENTE',
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'LOJA',
      updatedAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);
    writeOrders(orders);

    const logDetails = `Loja cadastrou Pedido #${nextNum} para ${newOrder.customerName} (${newOrder.services.map((s) => s.name).join(', ')})`;
    addLog('LOJA', 'NOVO_PEDIDO', logDetails, newOrder.id);

    console.log(`[PEDIDO NOVO] #${nextNum} criado por ${newOrder.createdBy}. Transmitindo em tempo real.`);

    // Broadcast in real-time to Cuteleiro and other open Loja tabs
    broadcastSSE({
      type: 'ORDER_CREATED',
      order: newOrder,
      message: 'NOVO PEDIDO RECEBIDO DA LOJA',
    });

    // Dispara notificação push oficial que acorda os celulares mesmo com app fechado
    sendPushToAll({
      title: `Fronteira Cutelaria - Novo Pedido #${nextNum}!`,
      body: `Cliente: ${newOrder.customerName} | Serviços: ${newOrder.services.map((s) => s.name).join(', ')}`,
      tag: `pedido-novo-${newOrder.id}`,
      url: '/',
      orderId: newOrder.id,
      role: 'CUTELEIRO',
    }).catch((pushErr) => console.warn('[Push] Erro ao enviar push para cuteleiro:', pushErr));

    if (newOrder.services.some((s) => s.name && s.name.toUpperCase().includes('BAINHA'))) {
      sendPushToAll({
        title: `Fronteira Cutelaria - Nova Bainha #${nextNum}!`,
        body: `Cliente: ${newOrder.customerName} | Nova bainha para confecção`,
        tag: `bainha-nova-${newOrder.id}`,
        url: '/guasqueiro',
        orderId: newOrder.id,
        role: 'GUASQUEIRO',
      }).catch((pushErr) => console.warn('[Push] Erro ao enviar push para guasqueiro:', pushErr));
    }

    res.status(201).json(newOrder);
  } catch (err: unknown) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Erro interno ao salvar pedido.' });
  }
});

// Cuteleiro marks order as ready (PRONTA)
app.put('/api/orders/:id/ready', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = readOrders();
    const orderIndex = orders.findIndex((o) => o.id === id);

    if (orderIndex === -1) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    const order = orders[orderIndex];
    order.status = 'PRONTA';
    order.completedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    orders[orderIndex] = order;
    writeOrders(orders);

    const logDetails = `Cuteleiro marcou Pedido #${order.orderNumber} (${order.customerName}) como PRONTO`;
    addLog('CUTELEIRO', 'FACA_PRONTA', logDetails, order.id);

    console.log(`[STATUS PRONTA] Pedido #${order.orderNumber} marcado como PRONTA.`);

    // Broadcast in real-time to Loja
    broadcastSSE({
      type: 'ORDER_READY',
      order,
      message: `Faca do pedido #${order.orderNumber} (${order.customerName}) está PRONTA!`,
    });

    // Dispara push para a loja mesmo com aplicativo ou navegador fechado
    sendPushToAll({
      title: `Fronteira Cutelaria - Lâmina Pronta #${order.orderNumber}!`,
      body: `A peça de ${order.customerName} está PRONTA para retirada na loja!`,
      tag: `pedido-pronto-${order.id}`,
      url: '/',
      orderId: order.id,
      role: 'LOJA',
    }).catch((pushErr) => console.warn('[Push] Erro ao enviar push para loja:', pushErr));

    res.json(order);
  } catch (err: unknown) {
    console.error('Error marking order ready:', err);
    res.status(500).json({ error: 'Erro ao marcar pedido como pronto.' });
  }
});

// Edit existing order
app.put('/api/orders/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = readOrders();
    const orderIndex = orders.findIndex((o) => o.id === id);

    if (orderIndex === -1) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    const current = orders[orderIndex];
    const updateData = req.body;

    const updatedOrder: OrderItem = {
      ...current,
      ...updateData,
      id: current.id,
      orderNumber: current.orderNumber,
      updatedAt: new Date().toISOString(),
    };

    orders[orderIndex] = updatedOrder;
    writeOrders(orders);

    const logDetails = `Loja editou o Pedido #${updatedOrder.orderNumber} (${updatedOrder.customerName})`;
    addLog('LOJA', 'PEDIDO_EDITADO', logDetails, updatedOrder.id);

    console.log(`[EDITAR PEDIDO] Pedido #${updatedOrder.orderNumber} atualizado por Loja.`);

    broadcastSSE({
      type: 'ORDER_UPDATED',
      order: updatedOrder,
      message: `Pedido #${updatedOrder.orderNumber} (${updatedOrder.customerName}) foi atualizado pela loja.`,
    });

    res.json(updatedOrder);
  } catch (err: unknown) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Erro ao atualizar pedido.' });
  }
});

// Loja delivers knife (DAR BAIXA)
app.put('/api/orders/:id/deliver', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = readOrders();
    const orderIndex = orders.findIndex((o) => o.id === id);

    if (orderIndex === -1) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    const order = orders[orderIndex];
    order.status = 'ENTREGUE';
    order.deliveredAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    orders[orderIndex] = order;
    writeOrders(orders);

    const logDetails = `Loja deu baixa no Pedido #${order.orderNumber} (${order.customerName}) - Entregue ao cliente`;
    addLog('LOJA', 'FACA_ENTREGUE', logDetails, order.id);

    console.log(`[DAR BAIXA] Pedido #${order.orderNumber} entregue. Removido do cuteleiro.`);

    // Broadcast in real-time
    broadcastSSE({
      type: 'ORDER_DELIVERED',
      order,
      message: `Pedido #${order.orderNumber} foi ENTREGUE ao cliente e transferido para o histórico.`,
    });

    res.json(order);
  } catch (err: unknown) {
    console.error('Error delivering order:', err);
    res.status(500).json({ error: 'Erro ao dar baixa no pedido.' });
  }
});

// Photo upload endpoint
app.post('/api/upload', (req: Request, res: Response) => {
  try {
    const { imageBase64, filename } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'Nenhuma imagem enviada.' });
      return;
    }

    // Parse base64 header
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // Return as is if already a valid URL or formatted
      res.json({ url: imageBase64 });
      return;
    }

    const ext = matches[1].split('/')[1] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const safeName = `faca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${safeName}`;

    addLog('SISTEMA', 'UPLOAD_FOTO', `Foto salva com sucesso: ${safeName}`);
    res.json({ url: publicUrl });
  } catch (err: unknown) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Erro ao salvar foto no servidor.' });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`[CUTELARIA APP] Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`[BANCO DE DADOS] Centralizado em ${ORDERS_FILE}`);
    console.log(`[TEMPO REAL] SSE disponível em /api/events`);
    console.log(`====================================================`);
  });
}

startServer();

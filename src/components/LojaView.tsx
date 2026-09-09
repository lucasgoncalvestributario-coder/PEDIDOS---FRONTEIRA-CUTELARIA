import React, { useState } from 'react';
import { Order } from '../types';
import { calculateUrgency, formatDateBR, formatCurrency } from '../utils/dateUtils';
import {
  Plus,
  Search,
  CheckCircle,
  Phone,
  Scissors,
  DollarSign,
  ZoomIn,
  MessageCircle,
  Check,
  Send,
} from 'lucide-react';

interface LojaViewProps {
  orders: Order[];
  onOpenNovoPedido: () => void;
  onDeliverOrder: (orderId: string) => Promise<void>;
  onOpenPhoto: (photos: string[] | string, initialIndex?: number, customerName?: string) => void;
}

const STORE_ADDRESS = 'Avenida Minas Gerais, 305 - Anexo ao Posto Irmãos da Estrada.';

export const LojaView: React.FC<LojaViewProps> = ({
  orders,
  onOpenNovoPedido,
  onDeliverOrder,
  onOpenPhoto,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'TODOS' | 'PENDENTES' | 'PRONTOS'>('TODOS');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Filter out delivered orders from active store view
  const activeOrders = orders.filter((o) => o.status !== 'ENTREGUE');

  const filteredOrders = activeOrders.filter((o) => {
    // Tab filter
    if (filterTab === 'PENDENTES' && o.status !== 'PENDENTE' && o.status !== 'EM PRODUÇÃO') {
      return false;
    }
    if (filterTab === 'PRONTOS' && o.status !== 'PRONTA') {
      return false;
    }

    // Search filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = o.customerName.toLowerCase().includes(term);
    const phoneMatch = o.customerPhone.toLowerCase().includes(term);
    const idMatch = o.id.toLowerCase().includes(term) || String(o.orderNumber).includes(term);
    const serviceMatch = o.services.some(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.details && s.details.toLowerCase().includes(term))
    );
    return nameMatch || phoneMatch || idMatch || serviceMatch;
  });

  const readyCount = activeOrders.filter((o) => o.status === 'PRONTA').length;
  const pendingCount = activeOrders.filter((o) => o.status === 'PENDENTE' || o.status === 'EM PRODUÇÃO').length;

  // Build WhatsApp message script (STRICTLY WITHOUT EMOJIS)
  const getWhatsAppRedirectionUrl = (order: Order) => {
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const message = `Olá, ${order.customerName}! Sua faca (Pedido #${order.orderNumber}) está pronta, pode vir retirar.\n\nNosso endereço é: ${STORE_ADDRESS}`;
    return `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`;
  };

  // ALL-IN-ONE SINGLE BUTTON ACTION:
  // "quando clicar em enviar mensagem para o cliente depois de pronta ela da baixa automaticamente, tudo em apenas um botão"
  const handleSendMessageAndDeliver = async (order: Order) => {
    if (processingOrderId) return;
    setProcessingOrderId(order.id);

    try {
      // 1. Open WhatsApp immediately with emoji-free message
      const url = getWhatsAppRedirectionUrl(order);
      window.open(url, '_blank');

      // 2. Automatically give baixa (mark order as delivered)
      await onDeliverOrder(order.id);

      // 3. User feedback
      setFeedbackMessage(`Pedido #${order.orderNumber} (${order.customerName}) baixado e WhatsApp aberto.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao dar baixa no pedido:', err);
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-5 pb-20">
      {/* Auto-dismiss notification banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-700 text-white font-black text-sm flex items-center gap-2 shadow-lg animate-in slide-in-from-top duration-200">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* 1. GIANT MOST EVIDENT BUTTON: [ + NOVO PEDIDO ] */}
      <div>
        <button
          id="btn-loja-novo-pedido"
          onClick={onOpenNovoPedido}
          className="w-full min-h-[88px] p-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-stone-950 font-black text-2xl uppercase tracking-wide shadow-xl border-b-4 border-amber-700 flex items-center justify-center gap-3 transition-all cursor-pointer"
        >
          <Plus className="w-9 h-9 stroke-[3]" />
          <span>+ NOVO PEDIDO</span>
        </button>
      </div>

      {/* 2. SEARCH AND FILTER TABS */}
      <div className="bg-white rounded-2xl p-3 border-2 border-stone-200 shadow-sm space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-busca-loja"
            type="text"
            placeholder="BUSCAR PEDIDO (CLIENTE, TELEFONE, SERVIÇO)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-3 py-3 bg-stone-50 font-bold text-sm uppercase rounded-xl border border-stone-300 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="grid grid-cols-3 gap-1.5 text-xs font-black uppercase">
          <button
            id="tab-loja-todos"
            onClick={() => setFilterTab('TODOS')}
            className={`py-2.5 px-1 rounded-xl transition-all ${
              filterTab === 'TODOS'
                ? 'bg-stone-900 text-amber-400 shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            TODOS ({activeOrders.length})
          </button>
          <button
            id="tab-loja-pendentes"
            onClick={() => setFilterTab('PENDENTES')}
            className={`py-2.5 px-1 rounded-xl transition-all ${
              filterTab === 'PENDENTES'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            PENDENTES ({pendingCount})
          </button>
          <button
            id="tab-loja-prontos"
            onClick={() => setFilterTab('PRONTOS')}
            className={`py-2.5 px-1 rounded-xl transition-all ${
              filterTab === 'PRONTOS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            PRONTOS ({readyCount})
          </button>
        </div>
      </div>

      {/* 3. ACTIVE ORDERS LIST AS BIG CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-black uppercase text-stone-600 px-1">
          <span>PEDIDOS EM ANDAMENTO ({filteredOrders.length})</span>
          {readyCount > 0 && (
            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 font-bold">
              {readyCount} faca(s) pronta(s) para entregar
            </span>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border-2 border-dashed border-stone-300 space-y-3">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-black uppercase text-stone-800">
              {searchTerm
                ? 'NENHUM PEDIDO ENCONTRADO'
                : 'NENHUM PEDIDO ATIVO NO MOMENTO'}
            </h3>
            <p className="text-sm font-medium text-stone-500">
              {searchTerm
                ? 'Verifique os termos digitados na busca.'
                : 'Clique no botão "+ NOVO PEDIDO" acima para cadastrar a primeira faca.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const urgency = calculateUrgency(order.deliveryDate);
            const isReady = order.status === 'PRONTA';
            const orderPhotos = order.photos && order.photos.length > 0 ? order.photos : (order.photoUrl ? [order.photoUrl] : []);
            const isDeliveringThis = processingOrderId === order.id;

            return (
              <div
                key={order.id}
                id={`card-order-${order.id}`}
                className={`bg-white rounded-3xl p-4 sm:p-5 shadow-lg border-4 transition-all ${
                  isReady
                    ? 'border-emerald-500 bg-emerald-50/25'
                    : urgency.isUrgent
                    ? 'border-red-500'
                    : 'border-stone-200'
                }`}
              >
                {/* Header of Card */}
                <div className="flex items-start justify-between gap-2 border-b border-stone-200 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-stone-500">
                      PEDIDO #{order.orderNumber}
                    </span>
                    <h3 className="text-2xl font-black text-stone-950 uppercase tracking-tight">
                      {order.customerName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <a
                        href={`tel:${order.customerPhone.replace(/\D/g, '')}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-bold text-stone-800 border border-stone-300"
                      >
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        <span>{order.customerPhone}</span>
                      </a>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isReady ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-stone-950 font-black text-xs uppercase tracking-wider shadow-sm animate-pulse flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        FACA PRONTA!
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider">
                        {order.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Knife Photos Gallery */}
                <div className="my-4 space-y-2">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-stone-300 bg-stone-950 aspect-video group">
                    <img
                      src={orderPhotos[0]}
                      alt={`Faca de ${order.customerName}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => onOpenPhoto(orderPhotos, 0, order.customerName)}
                    />
                    <button
                      onClick={() => onOpenPhoto(orderPhotos, 0, order.customerName)}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/80 text-white text-xs font-black uppercase rounded-xl flex items-center gap-1.5 shadow-md"
                    >
                      <ZoomIn className="w-4 h-4 text-amber-400" />
                      <span>{orderPhotos.length > 1 ? `VER ${orderPhotos.length} FOTOS` : 'AMPLIAR FOTO'}</span>
                    </button>

                    {orderPhotos.length > 1 && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 text-amber-300 text-xs font-mono font-bold rounded-lg flex items-center gap-1">
                        <span>{orderPhotos.length} FOTOS</span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnails if more than 1 photo */}
                  {orderPhotos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {orderPhotos.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => onOpenPhoto(orderPhotos, idx, order.customerName)}
                          className="w-16 h-16 rounded-xl overflow-hidden border-2 border-stone-300 hover:border-amber-500 flex-shrink-0 relative group"
                        >
                          <img src={p} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] font-bold text-white text-center">
                            #{idx + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Services List */}
                <div className="p-3 bg-stone-100 rounded-2xl border border-stone-200 space-y-1.5">
                  <span className="text-xs font-black uppercase text-stone-600 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-amber-600" />
                    SERVIÇOS SOLICITADOS:
                  </span>
                  <div className="space-y-1">
                    {order.services.map((srv, idx) => (
                      <div key={idx} className="font-black text-stone-900 text-sm">
                        • {srv.name} {srv.details ? `— [${srv.details}]` : ''}
                        {srv.notes && (
                          <span className="text-xs font-medium text-stone-600 block pl-3">
                            Obs: {srv.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date & Urgency Banner */}
                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="p-3 rounded-2xl bg-stone-100 border border-stone-300 flex-1">
                    <span className="text-[11px] font-bold text-stone-500 uppercase block">
                      DATA DE ENTREGA:
                    </span>
                    <span className="text-base font-black text-stone-900">
                      {formatDateBR(order.deliveryDate)}
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-2xl border-2 flex-1 flex items-center justify-center text-center ${urgency.bgClass} ${urgency.borderClass}`}
                  >
                    <span className={`font-black text-sm uppercase ${urgency.colorClass}`}>
                      {urgency.label}
                    </span>
                  </div>
                </div>

                {/* Financial Info */}
                {order.totalAmount > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between text-xs font-black uppercase">
                    <span className="text-stone-700 flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      VALOR COBRADO: {formatCurrency(order.totalAmount)}
                    </span>
                    {order.isFullyPaid ? (
                      <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg font-bold">
                        JÁ PAGO TUDO
                      </span>
                    ) : (
                      <span className="text-stone-800">
                        ENTRADA: {formatCurrency(order.paidAmount)} | RESTA:{' '}
                        {formatCurrency(Math.max(0, order.totalAmount - order.paidAmount))}
                      </span>
                    )}
                  </div>
                )}

                {/* 4. IF READY: SINGLE ALL-IN-ONE BUTTON */}
                {/* "quando clicar em enviar mensagem para o cliente depois de pronta ela da baixa automaticamente, tudo em apenas um botão, e a mensagem de script deve ser sem emojis" */}
                {isReady && (
                  <div className="mt-4 pt-3 border-t-2 border-emerald-300 space-y-2">
                    <div className="text-center">
                      <span className="text-xs font-black uppercase text-emerald-800 flex items-center justify-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        O cuteleiro concluiu o serviço desta faca!
                      </span>
                    </div>

                    <button
                      id={`btn-enviar-mensagem-dar-baixa-${order.id}`}
                      disabled={isDeliveringThis}
                      onClick={() => handleSendMessageAndDeliver(order)}
                      className="w-full min-h-[76px] p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xl sm:text-2xl uppercase tracking-wide shadow-xl border-b-4 border-emerald-800 flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <MessageCircle className="w-8 h-8 flex-shrink-0" />
                      <span>
                        {isDeliveringThis
                          ? 'DANDO BAIXA E ABRINDO WHATSAPP...'
                          : 'ENVIAR MENSAGEM AO CLIENTE E DAR BAIXA'}
                      </span>
                    </button>

                    <div className="text-center">
                      <span className="text-[11px] font-bold text-stone-500 uppercase">
                        (Em 1 clique: abre o WhatsApp com a mensagem de retirada e baixa o pedido)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Order } from '../types';
import { calculateUrgency, formatDateBR, formatCurrency } from '../utils/dateUtils';
import { EditarPedidoModal } from './EditarPedidoModal';
import {
  Plus,
  Search,
  CheckCircle,
  CheckCircle2,
  Phone,
  Scissors,
  DollarSign,
  ZoomIn,
  MessageCircle,
  Check,
  Send,
  History,
  Trash2,
  Edit3,
} from 'lucide-react';

interface LojaViewProps {
  orders: Order[];
  onOpenNovoPedido: () => void;
  onDeliverOrder: (orderId: string) => Promise<void>;
  onUpdateOrder: (orderId: string, updatedData: Partial<Order>) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<void>;
  onOpenPhoto: (photos: string[] | string, initialIndex?: number, customerName?: string) => void;
}

const STORE_ADDRESS = 'Avenida Minas Gerais, 305 - Anexo ao Posto Irmãos da Estrada.';

export const LojaView: React.FC<LojaViewProps> = ({
  orders,
  onOpenNovoPedido,
  onDeliverOrder,
  onUpdateOrder,
  onDeleteOrder,
  onOpenPhoto,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'TODOS' | 'PENDENTES' | 'PRONTOS' | 'HISTORICO'>('TODOS');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveEditedOrder = async (orderId: string, updatedData: Partial<Order>) => {
    try {
      await onUpdateOrder(orderId, updatedData);
      setFeedbackMessage(`Pedido #${orderToEdit?.orderNumber || ''} atualizado com sucesso! Alterações enviadas ao cuteleiro.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar pedido editado:', err);
    }
  };

  // Orders separation
  const activeOrders = orders.filter((o) => o.status !== 'ENTREGUE');
  const deliveredOrders = orders.filter((o) => o.status === 'ENTREGUE');

  const baseOrders = filterTab === 'HISTORICO' ? deliveredOrders : activeOrders;

  const filteredOrders = baseOrders.filter((o) => {
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

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    const orderNum = orderToDelete.orderNumber;
    try {
      if (onDeleteOrder) {
        await onDeleteOrder(orderToDelete.id);
      }
      setFeedbackMessage(`Pedido #${orderNum} excluído com sucesso do histórico.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
      setOrderToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir pedido:', err);
    } finally {
      setIsDeleting(false);
    }
  };

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

        {/* Botão de Histórico de Entregas */}
        <button
          id="btn-loja-historico"
          onClick={() => setFilterTab(filterTab === 'HISTORICO' ? 'TODOS' : 'HISTORICO')}
          className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-wider transition-all border shadow-sm cursor-pointer ${
            filterTab === 'HISTORICO'
              ? 'bg-stone-900 text-amber-400 border-stone-950 ring-2 ring-amber-400/40'
              : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-500 stroke-[2.5]" />
            <span>HISTÓRICO DE PEDIDOS ENTREGUES</span>
          </div>
          <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-900 border border-amber-400/40">
            {deliveredOrders.length}
          </span>
        </button>
      </div>

      {/* 3. ACTIVE ORDERS LIST AS BIG CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-black uppercase text-stone-600 px-1">
          <span>
            {filterTab === 'HISTORICO'
              ? `HISTÓRICO DE PEDIDOS ENTREGUES (${filteredOrders.length})`
              : `PEDIDOS EM ANDAMENTO (${filteredOrders.length})`}
          </span>
          {filterTab !== 'HISTORICO' && readyCount > 0 && (
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
            const isDelivered = order.status === 'ENTREGUE';
            const urgency = calculateUrgency(order.deliveryDate, isDelivered);
            const isReady = order.status === 'PRONTA';
            const orderPhotos = order.photos && order.photos.length > 0 ? order.photos : (order.photoUrl ? [order.photoUrl] : []);
            const isDeliveringThis = processingOrderId === order.id;

            return (
              <div
                key={order.id}
                id={`card-order-${order.id}`}
                className={`bg-white rounded-3xl p-4 sm:p-5 shadow-lg border-4 transition-all ${
                  isDelivered
                    ? 'border-stone-300 bg-stone-50/50'
                    : isReady
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
                      <button
                        id={`btn-editar-pedido-${order.id}`}
                        onClick={() => setOrderToEdit(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 active:scale-95 rounded-lg text-xs font-black text-amber-950 border border-amber-300 cursor-pointer shadow-xs transition-all"
                        title="Editar dados deste pedido (cliente, fotos, serviços, valores, prazo)"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                        <span>EDITAR PEDIDO</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {order.status === 'ENTREGUE' ? (
                      <span className="px-3 py-1.5 rounded-xl bg-stone-900 text-emerald-400 font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1 border border-emerald-500/50">
                        <CheckCircle2 className="w-4 h-4" />
                        ENTREGUE
                      </span>
                    ) : isReady ? (
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-stone-600 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-amber-600" />
                      SERVIÇOS SOLICITADOS:
                    </span>
                    <span className="text-[11px] font-bold text-stone-500 uppercase">
                      {order.services.length} serviço(s)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.services.map((srv, idx) => (
                      <div key={idx} className="font-black text-stone-900 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            • {srv.name} {srv.details ? `— [${srv.details}]` : ''}
                          </span>
                          {srv.price !== undefined && srv.price > 0 && (
                            <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                              {formatCurrency(srv.price)}
                            </span>
                          )}
                        </div>
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

                  {isDelivered ? (
                    <div className="p-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 flex-1 flex items-center justify-center text-center">
                      <span className="font-black text-sm uppercase text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        PEDIDO ENTREGUE AO CLIENTE
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-2xl border-2 flex-1 flex items-center justify-center text-center ${urgency.bgClass} ${urgency.borderClass}`}
                    >
                      <span className={`font-black text-sm uppercase ${urgency.colorClass}`}>
                        {urgency.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Financial Info */}
                <div className="mt-3 p-3.5 bg-amber-50 rounded-2xl border-2 border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase">
                  <span className="text-stone-800 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    VALOR TOTAL:{' '}
                    <span className="font-mono text-base text-stone-950 font-black">
                      {order.totalAmount > 0 ? formatCurrency(order.totalAmount) : 'R$ 0,00'}
                    </span>
                  </span>
                  {order.isFullyPaid ? (
                    <span className="text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl font-bold border border-emerald-300">
                      JÁ PAGO TUDO
                    </span>
                  ) : order.paidAmount > 0 ? (
                    <span className="text-amber-900 bg-amber-100 px-2.5 py-1 rounded-xl font-bold border border-amber-300">
                      ENTRADA: {formatCurrency(order.paidAmount)} | RESTA:{' '}
                      {formatCurrency(Math.max(0, order.totalAmount - order.paidAmount))}
                    </span>
                  ) : (
                    <span className="text-stone-700 bg-stone-200 px-2.5 py-1 rounded-xl font-bold">
                      A PAGAR NA ENTREGA
                    </span>
                  )}
                </div>

                {/* Botão de Edição Rápida para Pedidos em Aberto */}
                {!isReady && !isDelivered && (
                  <div className="mt-3 pt-2.5 border-t border-stone-200">
                    <button
                      id={`btn-loja-editar-detalhes-${order.id}`}
                      onClick={() => setOrderToEdit(order)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-950 font-black text-xs uppercase tracking-wider border-2 border-amber-300 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Edit3 className="w-4 h-4 text-amber-700 stroke-[2.5]" />
                      <span>EDITAR DADOS OU SERVIÇOS DESTE PEDIDO</span>
                    </button>
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

                {/* 5. IF DELIVERED: SHOW DELIVERED BADGE & DELETE FROM HISTORY BUTTON */}
                {order.status === 'ENTREGUE' && (
                  <div className="mt-4 pt-3 border-t-2 border-stone-200 space-y-2.5">
                    <div className="p-3 bg-stone-100 rounded-2xl text-center space-y-0.5 border border-stone-200">
                      <div className="flex items-center justify-center gap-1.5 text-stone-700 font-black text-sm uppercase">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        <span>PEDIDO ENTREGUE AO CLIENTE</span>
                      </div>
                      <p className="text-[11px] text-stone-500 font-bold">
                        {order.deliveredAt
                          ? `Entregue em: ${formatDateBR(order.deliveredAt.substring(0, 10))}`
                          : 'Faca entregue com sucesso.'}
                      </p>
                    </div>

                    {onDeleteOrder && (
                      <button
                        id={`btn-loja-excluir-historico-${order.id}`}
                        onClick={() => setOrderToDelete(order)}
                        className="w-full py-3 px-4 rounded-2xl bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-700 border border-stone-300 hover:border-red-300 font-black text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-sm active:scale-98"
                        title="Excluir este pedido definitivamente do histórico"
                      >
                        <Trash2 className="w-4 h-4 text-stone-400 group-hover:text-red-600 transition-colors" />
                        <span>EXCLUIR ESTE PEDIDO DO HISTÓRICO</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CONFIRMATION MODAL FOR DELETING ORDER FROM HISTÓRICO */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 text-center shadow-2xl border-4 border-red-500 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-black text-stone-950 uppercase leading-tight">
                EXCLUIR DO HISTÓRICO?
              </h3>
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-left space-y-1">
                <p className="text-sm font-black text-stone-900 uppercase">
                  PEDIDO #{orderToDelete.orderNumber}
                </p>
                <p className="text-xs font-bold text-stone-700 uppercase">
                  CLIENTE: {orderToDelete.customerName}
                </p>
                <p className="text-xs text-stone-500">
                  SERVIÇOS: {orderToDelete.services.map((s) => s.name).join(', ')}
                </p>
              </div>
              <p className="text-xs text-red-600 font-black uppercase">
                Atenção: Este pedido será excluído definitivamente do banco de dados e do histórico.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <button
                id="btn-confirm-loja-sim-excluir"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="w-full min-h-[60px] p-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-98 text-white font-black text-base uppercase tracking-wide shadow-lg border-b-4 border-red-800 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Trash2 className="w-5 h-5" />
                <span>{isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR DEFINITIVAMENTE'}</span>
              </button>

              <button
                id="btn-cancel-loja-excluir"
                disabled={isDeleting}
                onClick={() => setOrderToDelete(null)}
                className="w-full py-3.5 rounded-2xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-black text-sm uppercase cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PEDIDO ENVIADO */}
      {orderToEdit && (
        <EditarPedidoModal
          isOpen={Boolean(orderToEdit)}
          order={orderToEdit}
          onClose={() => setOrderToEdit(null)}
          onSaveOrder={handleSaveEditedOrder}
        />
      )}
    </div>
  );
};

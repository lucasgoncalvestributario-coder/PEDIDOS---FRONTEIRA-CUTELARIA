import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { calculateUrgency, formatDateBR, formatCurrency } from '../utils/dateUtils';
import {
  Hammer,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  Search,
  ZoomIn,
  Bell,
  Scissors,
  Check,
  Calendar,
  MessageCircle,
  Phone,
  History,
  ArrowLeft,
  Trash2,
  DollarSign,
} from 'lucide-react';

interface CuteleiroViewProps {
  orders: Order[];
  onMarkOrderReady: (orderId: string) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<void>;
  onOpenPhoto: (photos: string[] | string, initialIndex?: number, customerName?: string) => void;
  newOrderAlert: Order | null;
  onDismissAlert: () => void;
}

type CuteleiroTab = 'PENDENCIAS' | 'PROXIMAS' | 'PRONTOS' | 'TODOS' | 'HISTORICO';

export const CuteleiroView: React.FC<CuteleiroViewProps> = ({
  orders,
  onMarkOrderReady,
  onDeleteOrder,
  onOpenPhoto,
  newOrderAlert,
  onDismissAlert,
}) => {
  const [activeTab, setActiveTab] = useState<CuteleiroTab>('PENDENCIAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  // Orders not delivered yet (only LOJA can give baja / ENTREGUE)
  const activeOrders = orders.filter((o) => o.status !== 'ENTREGUE');

  // Orders delivered (Histórico)
  const historicoOrders = orders.filter((o) => o.status === 'ENTREGUE');

  // 1. Pendências: status !== 'PRONTA' and status !== 'ENTREGUE'
  const pendenciasOrders = activeOrders.filter(
    (o) => o.status === 'PENDENTE' || o.status === 'EM PRODUÇÃO'
  );

  // 2. Entregas próximas: pendentes e diffDays <= 3 ou atrasados
  const proximasOrders = pendenciasOrders.filter((o) => {
    const urg = calculateUrgency(o.deliveryDate);
    return urg.isUrgent; // <= 3 days or delayed
  });

  // 3. Prontos: status === 'PRONTA'
  const prontosOrders = activeOrders.filter((o) => o.status === 'PRONTA');

  // Link do WhatsApp do cliente para o cuteleiro tirar dúvidas durante o processo
  const getCuteleiroWhatsAppUrl = (order: Order) => {
    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    if (!cleanPhone) return '';
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const servicesList = order.services.map((s) => s.name).join(', ');
    const message = `Olá, ${order.customerName}! Aqui é o cuteleiro da Fronteira Cutelaria referente ao seu Pedido #${order.orderNumber} (${servicesList}). Gostaria de tirar uma dúvida sobre a sua faca...`;
    return `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`;
  };

  // Filter based on active tab
  const getTabOrders = () => {
    switch (activeTab) {
      case 'PENDENCIAS':
        return pendenciasOrders;
      case 'PROXIMAS':
        return proximasOrders;
      case 'PRONTOS':
        return prontosOrders;
      case 'HISTORICO':
        return historicoOrders;
      case 'TODOS':
      default:
        return activeOrders;
    }
  };

  const currentTabOrders = getTabOrders();

  // Search filter
  const filteredOrders = currentTabOrders.filter((o) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = o.customerName.toLowerCase().includes(term);
    const phoneMatch = o.customerPhone && o.customerPhone.toLowerCase().includes(term);
    const idMatch = o.id.toLowerCase().includes(term) || String(o.orderNumber).includes(term);
    const serviceMatch = o.services.some(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.details && s.details.toLowerCase().includes(term)) ||
        (s.notes && s.notes.toLowerCase().includes(term))
    );
    return nameMatch || phoneMatch || idMatch || serviceMatch;
  });

  const handleConfirmReady = async (orderId: string) => {
    setIsProcessing(true);
    setConfirmingOrderId(null);
    try {
      await onMarkOrderReady(orderId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    const orderNum = orderToDelete.orderNumber;
    try {
      if (onDeleteOrder) {
        await onDeleteOrder(orderToDelete.id);
      }
      setDeleteFeedback(`Pedido #${orderNum} excluído com sucesso do histórico.`);
      setTimeout(() => setDeleteFeedback(null), 4000);
      setOrderToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir pedido:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const orderBeingConfirmed = orders.find((o) => o.id === confirmingOrderId);

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-5 pb-24">
      {/* FEEDBACK DE EXCLUSÃO */}
      {deleteFeedback && (
        <div
          id="banner-delete-feedback"
          className="p-4 rounded-2xl bg-stone-900 text-amber-300 border-2 border-amber-500 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm font-bold uppercase">{deleteFeedback}</span>
          </div>
          <button
            onClick={() => setDeleteFeedback(null)}
            className="text-xs font-black text-stone-400 hover:text-white uppercase px-2 py-1 bg-stone-800 rounded-lg cursor-pointer"
          >
            FECHAR
          </button>
        </div>
      )}

      {/* REAL-TIME NEW ORDER NOTIFICATION BANNER */}
      {newOrderAlert && (
        <div
          id="banner-novo-pedido"
          className="p-4 rounded-3xl bg-amber-400 text-stone-950 border-4 border-amber-600 shadow-2xl animate-bounce space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-7 h-7 fill-current stroke-stone-950" />
              <h3 className="text-xl font-black uppercase tracking-tight">
                🔔 NOVO PEDIDO RECEBIDO!
              </h3>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500 px-2 py-1 rounded-lg">
              #{newOrderAlert.orderNumber}
            </span>
          </div>

          <p className="text-base font-bold">
            Chegou uma nova faca para produção de{' '}
            <strong className="underline">{newOrderAlert.customerName}</strong>.
          </p>

          <div className="flex gap-2">
            <button
              id="btn-ver-novo-pedido-alert"
              onClick={() => {
                setActiveTab('PENDENCIAS');
                onDismissAlert();
                // scroll to card
                const el = document.getElementById(`card-cuteleiro-${newOrderAlert.id}`);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex-1 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-2xl font-black text-sm uppercase tracking-wider shadow-md"
            >
              VER PEDIDO AGORA
            </button>
            <button
              id="btn-fechar-alerta"
              onClick={onDismissAlert}
              className="py-3 px-4 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-2xl font-black text-sm uppercase"
            >
              FECHAR
            </button>
          </div>
        </div>
      )}

      {/* THE THREE HUGE SQUARES / BUTTONS - VISUAL HEART OF THE APP */}
      <div className="space-y-2">
        <div className="text-center">
          <span className="text-xs font-black uppercase tracking-wider text-stone-500">
            TOQUE EM UM QUADRADO PARA FILTRAR
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* QUADRADO 1 — AMARELO (PENDÊNCIAS) */}
          <button
            id="btn-quadrado-pendencias"
            onClick={() => setActiveTab('PENDENCIAS')}
            className={`min-h-[120px] sm:min-h-[140px] p-3 sm:p-4 rounded-3xl flex flex-col items-center justify-center text-center transition-all border-4 shadow-lg ${
              activeTab === 'PENDENCIAS'
                ? 'bg-amber-400 border-amber-600 ring-4 ring-amber-300/50 scale-[1.03]'
                : 'bg-amber-100/90 border-amber-400 hover:bg-amber-200'
            }`}
          >
            <span className="text-4xl sm:text-5xl font-black text-stone-950 leading-none">
              {pendenciasOrders.length}
            </span>
            <span className="text-xs sm:text-sm font-black uppercase text-stone-900 mt-2 tracking-tight">
              PENDÊNCIAS
            </span>
            <span className="text-[10px] font-bold text-stone-700 hidden sm:inline">
              A FAZER
            </span>
          </button>

          {/* QUADRADO 2 — VERMELHO (ENTREGAS PRÓXIMAS) */}
          <button
            id="btn-quadrado-proximas"
            onClick={() => setActiveTab('PROXIMAS')}
            className={`min-h-[120px] sm:min-h-[140px] p-3 sm:p-4 rounded-3xl flex flex-col items-center justify-center text-center transition-all border-4 shadow-lg ${
              activeTab === 'PROXIMAS'
                ? 'bg-red-500 border-red-700 text-white ring-4 ring-red-300/50 scale-[1.03]'
                : 'bg-red-100 border-red-400 text-red-900 hover:bg-red-200'
            }`}
          >
            <span className="text-4xl sm:text-5xl font-black leading-none">
              {proximasOrders.length}
            </span>
            <span className="text-xs sm:text-sm font-black uppercase mt-2 tracking-tight leading-tight">
              ENTREGAS PRÓXIMAS
            </span>
            <span className="text-[10px] font-bold hidden sm:inline opacity-90">
              ≤ 3 DIAS / ATRASO
            </span>
          </button>

          {/* QUADRADO 3 — VERDE (PRONTOS) */}
          <button
            id="btn-quadrado-prontos"
            onClick={() => setActiveTab('PRONTOS')}
            className={`min-h-[120px] sm:min-h-[140px] p-3 sm:p-4 rounded-3xl flex flex-col items-center justify-center text-center transition-all border-4 shadow-lg ${
              activeTab === 'PRONTOS'
                ? 'bg-emerald-600 border-emerald-800 text-white ring-4 ring-emerald-300/50 scale-[1.03]'
                : 'bg-emerald-100 border-emerald-400 text-emerald-950 hover:bg-emerald-200'
            }`}
          >
            <span className="text-4xl sm:text-5xl font-black leading-none">
              {prontosOrders.length}
            </span>
            <span className="text-xs sm:text-sm font-black uppercase mt-2 tracking-tight">
              PRONTOS
            </span>
            <span className="text-[10px] font-bold hidden sm:inline opacity-90">
              FINALIZADOS
            </span>
          </button>
        </div>

        {/* ÍCONE E BOTÃO DE HISTÓRICO PARA O CUTELEIRO */}
        <button
          id="btn-cuteleiro-historico"
          onClick={() => setActiveTab(activeTab === 'HISTORICO' ? 'PENDENCIAS' : 'HISTORICO')}
          className={`w-full py-3.5 px-4 rounded-2xl flex items-center justify-between font-black text-sm uppercase tracking-wider transition-all border-2 shadow-sm cursor-pointer ${
            activeTab === 'HISTORICO'
              ? 'bg-stone-950 text-amber-400 border-amber-500 shadow-md ring-2 ring-amber-400/40'
              : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50 hover:border-stone-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-500 stroke-[2.5]" />
            <span>HISTÓRICO DE PEDIDOS ENTREGUES</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-900 border border-amber-400/40">
            {historicoOrders.length} {historicoOrders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}
          </span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          id="input-busca-cuteleiro"
          type="text"
          placeholder="BUSCAR PEDIDO (NOME, TELEFONE OU SERVIÇO)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white font-bold text-sm uppercase rounded-2xl border-2 border-stone-300 focus:outline-none focus:border-amber-500 shadow-sm"
        />
      </div>

      {/* ACTIVE TAB LABEL */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              activeTab === 'PENDENCIAS'
                ? 'bg-amber-500'
                : activeTab === 'PROXIMAS'
                ? 'bg-red-500'
                : activeTab === 'PRONTOS'
                ? 'bg-emerald-500'
                : activeTab === 'HISTORICO'
                ? 'bg-stone-800'
                : 'bg-stone-400'
            }`}
          />
          <h2 className="text-base font-black uppercase text-stone-800 flex items-center gap-2">
            {activeTab === 'PENDENCIAS' && `LISTA DE PENDÊNCIAS (${pendenciasOrders.length})`}
            {activeTab === 'PROXIMAS' && `PEDIDOS PRÓXIMOS DA ENTREGA (${proximasOrders.length})`}
            {activeTab === 'PRONTOS' && `FACAS PRONTAS (${prontosOrders.length})`}
            {activeTab === 'TODOS' && `TODOS OS PEDIDOS ATIVOS (${activeOrders.length})`}
            {activeTab === 'HISTORICO' && (
              <>
                <History className="w-4 h-4 text-amber-600 inline stroke-[2.5]" />
                <span>HISTÓRICO DE ENTREGAS ({historicoOrders.length})</span>
              </>
            )}
          </h2>
        </div>

        {activeTab === 'HISTORICO' ? (
          <button
            onClick={() => setActiveTab('PENDENCIAS')}
            className="text-xs font-black uppercase text-amber-800 hover:text-amber-950 flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>VER PENDÊNCIAS</span>
          </button>
        ) : activeTab !== 'TODOS' ? (
          <button
            onClick={() => setActiveTab('TODOS')}
            className="text-xs font-bold uppercase text-stone-500 hover:text-stone-800 underline cursor-pointer"
          >
            VER TODOS
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('PENDENCIAS')}
            className="text-xs font-bold uppercase text-stone-500 hover:text-stone-800 underline cursor-pointer"
          >
            VER PENDÊNCIAS
          </button>
        )}
      </div>

      {/* ORDERS LIST */}
      <div className="space-y-5">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border-2 border-dashed border-stone-300 space-y-3">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-black uppercase text-stone-800">
              NENHUM PEDIDO NESTA SEÇÃO
            </h3>
            <p className="text-sm font-medium text-stone-500">
              {activeTab === 'PROXIMAS'
                ? 'Ótimo trabalho! Nenhuma entrega está atrasada ou nos próximos 3 dias.'
                : activeTab === 'PENDENCIAS'
                ? 'Todas as facas foram concluídas!'
                : activeTab === 'HISTORICO'
                ? 'Nenhum pedido entregue registrado no histórico ainda.'
                : 'Nenhum pedido correspondente ao filtro.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const urgency = calculateUrgency(order.deliveryDate);
            const isReady = order.status === 'PRONTA';
            const isDelivered = order.status === 'ENTREGUE';
            const orderPhotos = order.photos && order.photos.length > 0 ? order.photos : (order.photoUrl ? [order.photoUrl] : []);

            return (
              <div
                key={order.id}
                id={`card-cuteleiro-${order.id}`}
                className={`bg-white rounded-3xl overflow-hidden shadow-xl border-4 transition-all ${
                  isDelivered
                    ? 'border-stone-400 bg-stone-50/50'
                    : isReady
                    ? 'border-emerald-500'
                    : urgency.isUrgent
                    ? 'border-red-500'
                    : 'border-stone-300'
                }`}
              >
                {/* 1. LARGE KNIFE PHOTO AT TOP OF CARD */}
                <div className="relative w-full aspect-video bg-stone-950 overflow-hidden group">
                  <img
                    src={orderPhotos[0]}
                    alt={`Faca do cliente ${order.customerName}`}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => onOpenPhoto(orderPhotos, 0, order.customerName)}
                  />
                  <button
                    onClick={() => onOpenPhoto(orderPhotos, 0, order.customerName)}
                    className="absolute bottom-3 right-3 px-3.5 py-1.5 bg-black/80 text-white font-black text-xs uppercase rounded-xl flex items-center gap-1.5 shadow-lg"
                  >
                    <ZoomIn className="w-4 h-4 text-amber-400" />
                    <span>{orderPhotos.length > 1 ? `VER ${orderPhotos.length} FOTOS` : 'AMPLIAR FOTO DA FACA'}</span>
                  </button>

                  <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/85 text-amber-400 font-mono font-black text-xs uppercase rounded-xl border border-stone-800 flex items-center gap-2 shadow-lg">
                    <span>PEDIDO #{order.orderNumber}</span>
                    <span className="text-stone-600">|</span>
                    <span className="text-white font-bold">TOTAL: {formatCurrency(order.totalAmount || 0)}</span>
                  </div>

                  {orderPhotos.length > 1 && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/80 text-amber-300 font-mono font-bold text-xs rounded-xl flex items-center gap-1">
                      <span>📷 {orderPhotos.length} FOTOS</span>
                    </div>
                  )}

                  {isDelivered && (
                    <div className="absolute top-3 right-3 px-3 py-1 bg-stone-900/90 text-emerald-400 font-black text-xs uppercase rounded-xl border border-emerald-500/50">
                      ✓ ENTREGUE
                    </div>
                  )}
                </div>

                {/* Thumbnails row if more than 1 photo */}
                {orderPhotos.length > 1 && (
                  <div className="flex gap-2 p-2 bg-stone-900 overflow-x-auto">
                    {orderPhotos.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => onOpenPhoto(orderPhotos, idx, order.customerName)}
                        className="w-16 h-16 rounded-xl overflow-hidden border-2 border-stone-700 hover:border-amber-400 flex-shrink-0 relative group"
                      >
                        <img src={p} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-bold text-white text-center">
                          #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. CARD CONTENT */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Customer Name & WhatsApp Contact for Cuteleiro */}
                  <div className="border-b border-stone-200 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-stone-500 block">
                        CLIENTE:
                      </span>
                      <h3 className="text-2xl font-black text-stone-950 uppercase tracking-tight">
                        {order.customerName}
                      </h3>
                      {order.customerPhone ? (
                        <span className="text-xs font-mono font-bold text-stone-600 block mt-0.5">
                          📞 {order.customerPhone}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400 italic block mt-0.5">
                          Sem telefone cadastrado
                        </span>
                      )}
                    </div>

                    {/* Botão de WhatsApp do Cliente para o Cuteleiro tirar dúvidas */}
                    {order.customerPhone ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          id={`btn-whatsapp-cuteleiro-${order.id}`}
                          href={getCuteleiroWhatsAppUrl(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Falar com o cliente no WhatsApp para tirar dúvidas sobre a faca"
                          className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase rounded-xl flex items-center gap-2 shadow-md transition-all border border-emerald-500 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 fill-current stroke-emerald-600 text-white" />
                          <span>WHATSAPP DO CLIENTE</span>
                        </a>
                        <a
                          href={`tel:${order.customerPhone.replace(/\D/g, '')}`}
                          title="Ligar para o cliente"
                          className="p-2.5 bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 rounded-xl border border-stone-300 transition-all cursor-pointer"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-stone-400 px-3 py-1.5 bg-stone-100 rounded-xl">
                        Sem WhatsApp
                      </span>
                    )}
                  </div>

                  {/* Services & specifications */}
                  <div className="p-3.5 bg-stone-100 rounded-2xl border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-stone-600 flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-amber-600" />
                        O QUE PRECISA SER FEITO:
                      </span>
                      <span className="text-[11px] font-bold text-stone-500 uppercase">
                        {order.services.length} serviço(s)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {order.services.map((srv, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-black text-stone-950 uppercase">
                              • {srv.name}
                            </span>
                            {srv.price !== undefined && srv.price > 0 && (
                              <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                                {formatCurrency(srv.price)}
                              </span>
                            )}
                          </div>
                          {srv.details && (
                            <div className="text-xs font-bold text-amber-900 bg-amber-50 p-1.5 rounded-lg inline-block border border-amber-200">
                              ESPECIFICAÇÃO: {srv.details}
                            </div>
                          )}
                          {srv.notes && (
                            <div className="text-xs font-semibold text-stone-700 pl-1">
                              Observação: {srv.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery date & Urgency Rule */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-bold text-stone-700">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-stone-500" />
                        ENTREGA:
                      </span>
                      <span className="font-black text-base text-stone-950">
                        {formatDateBR(order.deliveryDate)}
                      </span>
                    </div>

                    {/* Urgency Highlight Banner */}
                    <div
                      className={`p-3.5 rounded-2xl border-2 text-center flex items-center justify-center gap-2 ${urgency.bgClass} ${urgency.borderClass}`}
                    >
                      {urgency.isUrgent && (
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 animate-pulse" />
                      )}
                      <span className={`font-black text-base sm:text-lg uppercase ${urgency.colorClass}`}>
                        {urgency.label}
                      </span>
                    </div>
                  </div>

                  {/* Valor Total do Pedido / Serviço */}
                  <div className="p-4 bg-stone-900 text-white rounded-2xl border-2 border-stone-800 shadow-md space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow flex-shrink-0">
                          <DollarSign className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                            VALOR TOTAL DO PEDIDO
                          </span>
                          <span className="font-mono text-2xl font-black text-white leading-tight block">
                            {formatCurrency(order.totalAmount || 0)}
                          </span>
                        </div>
                      </div>

                      {order.isFullyPaid ? (
                        <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black uppercase tracking-wider">
                          ✓ TOTALMENTE PAGO
                        </span>
                      ) : order.paidAmount > 0 ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black uppercase tracking-wide">
                            ENTRADA PAGA: {formatCurrency(order.paidAmount)}
                          </span>
                          <span className="px-2.5 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-[11px] font-black uppercase tracking-wide">
                            RESTANTE NA ENTREGA: {formatCurrency(Math.max(0, (order.totalAmount || 0) - order.paidAmount))}
                          </span>
                        </div>
                      ) : (
                        <span className="px-3 py-1.5 bg-stone-800 text-stone-300 border border-stone-700 rounded-xl text-xs font-black uppercase tracking-wider">
                          A RECEBER NA ENTREGA
                        </span>
                      )}
                    </div>

                    {/* Explicação de entrada para o cuteleiro */}
                    {order.paidAmount > 0 && !order.isFullyPaid && (
                      <div className="pt-2 border-t border-stone-800 text-xs text-stone-300">
                        <p className="text-[11px] text-stone-400 font-medium leading-relaxed">
                          <strong className="text-amber-300 uppercase font-black">Informação do Pedido:</strong> O valor total deste serviço é de <strong className="text-white font-mono">{formatCurrency(order.totalAmount || 0)}</strong>. O cliente pagou uma entrada de <strong className="text-white font-mono">{formatCurrency(order.paidAmount)}</strong> e acertará o restante (<strong className="text-white font-mono">{formatCurrency(Math.max(0, (order.totalAmount || 0) - order.paidAmount))}</strong>) no momento da entrega na loja.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 3. BIG BUTTON: [ MARCAR COMO PRONTA ] OR STATUS PRONTA OR ENTREGUE */}
                  <div className="pt-2">
                    {isDelivered ? (
                      <div className="space-y-2.5">
                        <div className="p-4 rounded-2xl bg-stone-100 border-2 border-stone-300 text-center space-y-1">
                          <div className="flex items-center justify-center gap-2 text-stone-700 font-black text-lg uppercase">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 stroke-[2.5]" />
                            <span>PEDIDO ENTREGUE AO CLIENTE</span>
                          </div>
                          <p className="text-xs font-bold text-stone-500">
                            {order.deliveredAt
                              ? `Entregue em: ${formatDateBR(order.deliveredAt.substring(0, 10))}`
                              : 'Faca finalizada e entregue pela loja com sucesso.'}
                          </p>
                        </div>

                        {/* Botão de Excluir do Histórico */}
                        {onDeleteOrder && (
                          <button
                            id={`btn-excluir-historico-${order.id}`}
                            onClick={() => setOrderToDelete(order)}
                            className="w-full py-3 px-4 rounded-2xl bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-700 border border-stone-300 hover:border-red-300 font-black text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-sm active:scale-98"
                            title="Excluir este pedido definitivamente do histórico"
                          >
                            <Trash2 className="w-4 h-4 text-stone-400 group-hover:text-red-600 transition-colors" />
                            <span>EXCLUIR ESTE PEDIDO DO HISTÓRICO</span>
                          </button>
                        )}
                      </div>
                    ) : isReady ? (
                      <div className="p-4 rounded-2xl bg-emerald-100 border-2 border-emerald-500 text-center space-y-1">
                        <div className="flex items-center justify-center gap-2 text-emerald-800 font-black text-lg uppercase">
                          <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                          <span>FACA MARCADA COMO PRONTA!</span>
                        </div>
                        <p className="text-xs font-bold text-emerald-700">
                          Aguardando a loja entregar ao cliente e dar baixa.
                        </p>
                      </div>
                    ) : (
                      <button
                        id={`btn-marcar-pronta-${order.id}`}
                        onClick={() => setConfirmingOrderId(order.id)}
                        className="w-full min-h-[72px] p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xl uppercase tracking-wider shadow-lg border-b-4 border-emerald-800 flex items-center justify-center gap-3 transition-all cursor-pointer"
                      >
                        <Check className="w-8 h-8 stroke-[3]" />
                        <span>MARCAR COMO PRONTA</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONFIRMATION MODAL FOR "MARCAR COMO PRONTA" */}
      {orderBeingConfirmed && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 text-center shadow-2xl border-4 border-emerald-500 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-stone-950 uppercase leading-tight">
                ESSA FACA ESTÁ PRONTA?
              </h3>
              <p className="text-sm font-bold text-stone-600 uppercase">
                CLIENTE: {orderBeingConfirmed.customerName}
              </p>
              <p className="text-xs text-stone-500">
                Ao confirmar, a loja receberá imediatamente a informação em tempo real de que a faca está pronta para ser retirada pelo cliente.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                id="btn-confirm-sim-pronta"
                disabled={isProcessing}
                onClick={() => handleConfirmReady(orderBeingConfirmed.id)}
                className="w-full min-h-[64px] p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xl uppercase tracking-wide shadow-lg border-b-4 border-emerald-800 flex items-center justify-center gap-2"
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>{isProcessing ? 'ATUALIZANDO...' : 'SIM, ESTÁ PRONTA'}</span>
              </button>

              <button
                id="btn-cancel-pronta"
                disabled={isProcessing}
                onClick={() => setConfirmingOrderId(null)}
                className="w-full py-3.5 rounded-2xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-black text-base uppercase"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

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
                id="btn-confirm-sim-excluir"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="w-full min-h-[60px] p-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-98 text-white font-black text-base uppercase tracking-wide shadow-lg border-b-4 border-red-800 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Trash2 className="w-5 h-5" />
                <span>{isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR DEFINITIVAMENTE'}</span>
              </button>

              <button
                id="btn-cancel-excluir"
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
    </div>
  );
};

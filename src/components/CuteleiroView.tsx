import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { calculateUrgency, formatDateBR } from '../utils/dateUtils';
import {
  Hammer,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  ZoomIn,
  Bell,
  Scissors,
  Check,
  Calendar,
} from 'lucide-react';

interface CuteleiroViewProps {
  orders: Order[];
  onMarkOrderReady: (orderId: string) => Promise<void>;
  onOpenPhoto: (photos: string[] | string, initialIndex?: number, customerName?: string) => void;
  newOrderAlert: Order | null;
  onDismissAlert: () => void;
}

type CuteleiroTab = 'PENDENCIAS' | 'PROXIMAS' | 'PRONTOS' | 'TODOS';

export const CuteleiroView: React.FC<CuteleiroViewProps> = ({
  orders,
  onMarkOrderReady,
  onOpenPhoto,
  newOrderAlert,
  onDismissAlert,
}) => {
  const [activeTab, setActiveTab] = useState<CuteleiroTab>('PENDENCIAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Orders not delivered yet (only LOJA can give baja / ENTREGUE)
  const activeOrders = orders.filter((o) => o.status !== 'ENTREGUE');

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

  // Filter based on active tab
  const getTabOrders = () => {
    switch (activeTab) {
      case 'PENDENCIAS':
        return pendenciasOrders;
      case 'PROXIMAS':
        return proximasOrders;
      case 'PRONTOS':
        return prontosOrders;
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
    const idMatch = o.id.toLowerCase().includes(term) || String(o.orderNumber).includes(term);
    const serviceMatch = o.services.some(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.details && s.details.toLowerCase().includes(term)) ||
        (s.notes && s.notes.toLowerCase().includes(term))
    );
    return nameMatch || idMatch || serviceMatch;
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

  const orderBeingConfirmed = orders.find((o) => o.id === confirmingOrderId);

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-5 pb-24">
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
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          id="input-busca-cuteleiro"
          type="text"
          placeholder="BUSCAR PEDIDO (NOME OU SERVIÇO)..."
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
                : 'bg-emerald-500'
            }`}
          />
          <h2 className="text-base font-black uppercase text-stone-800">
            {activeTab === 'PENDENCIAS' && `LISTA DE PENDÊNCIAS (${pendenciasOrders.length})`}
            {activeTab === 'PROXIMAS' && `PEDIDOS PRÓXIMOS DA ENTREGA (${proximasOrders.length})`}
            {activeTab === 'PRONTOS' && `FACAS PRONTAS (${prontosOrders.length})`}
            {activeTab === 'TODOS' && `TODOS OS PEDIDOS ATIVOS (${activeOrders.length})`}
          </h2>
        </div>

        {activeTab !== 'TODOS' && (
          <button
            onClick={() => setActiveTab('TODOS')}
            className="text-xs font-bold uppercase text-stone-500 hover:text-stone-800 underline"
          >
            VER TODOS
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
                : 'Nenhum pedido correspondente ao filtro.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const urgency = calculateUrgency(order.deliveryDate);
            const isReady = order.status === 'PRONTA';
            const orderPhotos = order.photos && order.photos.length > 0 ? order.photos : (order.photoUrl ? [order.photoUrl] : []);

            return (
              <div
                key={order.id}
                id={`card-cuteleiro-${order.id}`}
                className={`bg-white rounded-3xl overflow-hidden shadow-xl border-4 transition-all ${
                  isReady
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

                  <div className="absolute top-3 left-3 px-3 py-1 bg-black/80 text-amber-400 font-mono font-black text-xs uppercase rounded-xl">
                    PEDIDO #{order.orderNumber}
                  </div>

                  {orderPhotos.length > 1 && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/80 text-amber-300 font-mono font-bold text-xs rounded-xl flex items-center gap-1">
                      <span>📷 {orderPhotos.length} FOTOS</span>
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
                  {/* Customer Name */}
                  <div className="border-b border-stone-100 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                      CLIENTE:
                    </span>
                    <h3 className="text-2xl font-black text-stone-950 uppercase tracking-tight">
                      {order.customerName}
                    </h3>
                  </div>

                  {/* Services & specifications */}
                  <div className="p-3.5 bg-stone-100 rounded-2xl border border-stone-200 space-y-2">
                    <span className="text-xs font-black uppercase text-stone-600 flex items-center gap-1.5">
                      <Scissors className="w-4 h-4 text-amber-600" />
                      O QUE PRECISA SER FEITO:
                    </span>

                    <div className="space-y-2">
                      {order.services.map((srv, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-stone-200">
                          <div className="text-base font-black text-stone-950 uppercase">
                            • {srv.name}
                          </div>
                          {srv.details && (
                            <div className="text-xs font-bold text-amber-800 bg-amber-50 p-1.5 rounded-lg mt-1 inline-block border border-amber-200">
                              ESPECIFICAÇÃO: {srv.details}
                            </div>
                          )}
                          {srv.notes && (
                            <div className="text-xs font-semibold text-stone-700 mt-1 pl-1">
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

                  {/* 3. BIG BUTTON: [ MARCAR COMO PRONTA ] OR STATUS PRONTA */}
                  <div className="pt-2">
                    {isReady ? (
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
                        className="w-full min-h-[72px] p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xl uppercase tracking-wider shadow-lg border-b-4 border-emerald-800 flex items-center justify-center gap-3 transition-all"
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
    </div>
  );
};

import React, { useState } from 'react';
import { Order } from '../types';
import {
  calculateUrgency,
  formatDateBR,
  formatPhone,
  extractBainhaInfo,
} from '../utils/dateUtils';
import {
  Scissors,
  CheckCircle2,
  Clock,
  Search,
  ZoomIn,
  MessageCircle,
  Phone,
  Calendar,
  Check,
  RotateCcw,
  Sparkles,
  History,
  Archive,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface GuasqueiroViewProps {
  orders: Order[];
  onUpdateOrder: (orderId: string, updatedData: Partial<Order>) => Promise<void>;
  onOpenPhoto: (photos: string[] | string, initialIndex?: number, customerName?: string) => void;
}

type GuasqueiroTab = 'A_FAZER' | 'HISTORICO';

export const GuasqueiroView: React.FC<GuasqueiroViewProps> = ({
  orders,
  onUpdateOrder,
  onOpenPhoto,
}) => {
  const [activeTab, setActiveTab] = useState<GuasqueiroTab>('A_FAZER');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // 1. FILTRAR APENAS PEDIDOS QUE CONTÉM SERVIÇO DE BAINHA
  // Quer seja somente a bainha ou venha acompanhada de afiação, polimento, etc.,
  // o guasqueiro visualiza exclusivamente a bainha!
  const allBainhaOrders = orders.filter((order) => {
    const info = extractBainhaInfo(order.services);
    return info !== null && info.hasBainha;
  });

  // 2. SEPARAÇÃO RIGOROSA:
  // Histórico do Guasqueiro: SOMENTE pedidos que ele explicitamente finalizou
  // (bainhaFinalizada === true). Pedidos concluídos pela loja/cuteleiro NÃO vão
  // para o histórico do guasqueiro automaticamente.
  const historicoOrders = allBainhaOrders.filter(
    (order) => order.bainhaFinalizada === true
  );

  // Pedidos ativos a fazer (visualização dos pedidos e prazos):
  // Tudo que tem bainha e ainda não foi finalizado pelo guasqueiro
  const aFazerOrders = allBainhaOrders.filter(
    (order) => !order.bainhaFinalizada
  );

  // Link do WhatsApp específico do Guasqueiro para tirar dúvidas sobre a bainha
  const getGuasqueiroWhatsAppUrl = (order: Order) => {
    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    if (!cleanPhone) return '';
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const bainha = extractBainhaInfo(order.services);
    const desc = bainha ? `bainha ${bainha.color.toLowerCase()} (${bainha.model})` : 'bainha';
    const message = `Olá, ${order.customerName}! Aqui é o guasqueiro da Fronteira Cutelaria referente à confecção da ${desc} da sua faca (Pedido #${order.orderNumber}). Gostaria de alinhar um detalhe...`;
    return `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(message)}`;
  };

  // Pedidos da aba ativa
  const currentTabOrders = activeTab === 'A_FAZER' ? aFazerOrders : historicoOrders;

  // Filtro de busca
  const filteredOrders = currentTabOrders.filter((order) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const bainha = extractBainhaInfo(order.services);
    const nameMatch = order.customerName.toLowerCase().includes(term);
    const phoneMatch = (order.customerPhone || '').toLowerCase().includes(term);
    const idMatch = String(order.orderNumber).includes(term) || order.id.toLowerCase().includes(term);
    const bainhaMatch =
      bainha &&
      (bainha.color.toLowerCase().includes(term) ||
        bainha.model.toLowerCase().includes(term) ||
        bainha.size.toLowerCase().includes(term) ||
        (bainha.notes && bainha.notes.toLowerCase().includes(term)));
    return nameMatch || phoneMatch || idMatch || bainhaMatch;
  });

  // Garantir que o histórico do guasqueiro inicie 100% zerado conforme solicitação do usuário
  React.useEffect(() => {
    const hasReset = localStorage.getItem('guasqueiro_history_zerado_v1');
    if (!hasReset) {
      const ordersWithFinalizada = orders.filter((o) => o.bainhaFinalizada === true);
      if (ordersWithFinalizada.length > 0) {
        ordersWithFinalizada.forEach((o) => {
          onUpdateOrder(o.id, { bainhaFinalizada: false, bainhaFinalizadaAt: undefined });
        });
      }
      localStorage.setItem('guasqueiro_history_zerado_v1', 'true');
    }
  }, [orders, onUpdateOrder]);

  // AÇÃO: Finalizar bainha (enviar imediatamente para o histórico pessoal do guasqueiro)
  const handleFinalizarBainha = async (order: Order) => {
    if (processingId) return;
    setProcessingId(order.id);
    try {
      const now = new Date().toISOString();
      await onUpdateOrder(order.id, {
        bainhaFinalizada: true,
        bainhaFinalizadaAt: now,
      });
      // Vai imediatamente para o histórico de bainhas conforme solicitado
      setActiveTab('HISTORICO');
      setFeedbackMessage(
        `Bainha do Pedido #${order.orderNumber} (${order.customerName}) finalizada e enviada imediatamente para o seu histórico!`
      );
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao finalizar bainha:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // AÇÃO: Reabrir bainha do histórico de volta para "A Fazer"
  const handleReabrirBainha = async (order: Order) => {
    if (processingId) return;
    setProcessingId(order.id);
    try {
      await onUpdateOrder(order.id, {
        bainhaFinalizada: false,
        bainhaFinalizadaAt: undefined,
      });
      setFeedbackMessage(`Bainha do Pedido #${order.orderNumber} retornada para a lista A Fazer.`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao reabrir bainha:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // AÇÃO: Zerar todo o histórico do guasqueiro
  const handleZerarHistorico = async () => {
    if (processingId) return;
    setProcessingId('all');
    try {
      for (const order of historicoOrders) {
        await onUpdateOrder(order.id, {
          bainhaFinalizada: false,
          bainhaFinalizadaAt: undefined,
        });
      }
      setConfirmClearHistory(false);
      setFeedbackMessage('Histórico do guasqueiro zerado com sucesso!');
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao zerar histórico:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-4 pb-20">
      {/* Banner de feedback */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-2xl bg-amber-700 text-white font-black text-sm flex items-center gap-2 shadow-lg animate-in slide-in-from-top duration-200">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Cabeçalho do Painel do Guasqueiro */}
      <div className="p-4 rounded-3xl bg-stone-900 border-2 border-stone-800 text-stone-100 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scissors className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Oficina de Couro & Bainhas
              </div>
              <h2 className="text-xl font-black uppercase text-white leading-tight">
                Painel do Guasqueiro
              </h2>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {aFazerOrders.length}
            </span>
            <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-tight">
              A Fazer
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-stone-800 text-xs text-stone-400 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            Visualização exclusiva das bainhas a fazer, modelos, fotos da faca e prazos.
          </span>
        </div>
      </div>

      {/* Duas Abas Claras: BAINHAS A FAZER & HISTÓRICO */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('A_FAZER')}
          className={`py-3.5 px-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wide transition-all cursor-pointer border-2 flex items-center justify-center gap-2 shadow-sm ${
            activeTab === 'A_FAZER'
              ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-amber-500/20 shadow-md'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
          }`}
        >
          <Clock className="w-4 h-4 flex-shrink-0 stroke-[2.5]" />
          <span>BAINHAS A FAZER</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
              activeTab === 'A_FAZER'
                ? 'bg-stone-950 text-amber-400'
                : 'bg-stone-200 text-stone-800'
            }`}
          >
            {aFazerOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORICO')}
          className={`py-3.5 px-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wide transition-all cursor-pointer border-2 flex items-center justify-center gap-2 shadow-sm ${
            activeTab === 'HISTORICO'
              ? 'bg-amber-900 text-amber-100 border-amber-950 shadow-amber-900/20 shadow-md'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
          }`}
        >
          <History className="w-4 h-4 flex-shrink-0 stroke-[2.5]" />
          <span>MEU HISTÓRICO</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
              activeTab === 'HISTORICO'
                ? 'bg-stone-950 text-amber-300'
                : 'bg-stone-200 text-stone-800'
            }`}
          >
            {historicoOrders.length}
          </span>
        </button>
      </div>

      {/* Opção de Zerar Histórico quando na aba Histórico */}
      {activeTab === 'HISTORICO' && historicoOrders.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-2xl border border-amber-200">
          <div className="text-xs text-amber-950 font-bold">
            Histórico somente das suas bainhas finalizadas ({historicoOrders.length})
          </div>
          {confirmClearHistory ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleZerarHistorico}
                disabled={processingId === 'all'}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black uppercase cursor-pointer"
              >
                SIM, ZERAR
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearHistory(false)}
                className="px-2 py-1 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearHistory(true)}
              className="text-xs font-bold text-red-700 hover:text-red-900 underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Zerar histórico</span>
            </button>
          )}
        </div>
      )}

      {/* Barra de busca */}
      <div className="relative">
        <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por cliente, nº do pedido, cor ou modelo..."
          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-stone-300 rounded-2xl text-sm font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400 hover:text-stone-700"
          >
            LIMPAR
          </button>
        )}
      </div>

      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border-2 border-stone-200 shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            {activeTab === 'HISTORICO' ? (
              <History className="w-8 h-8 stroke-[2]" />
            ) : (
              <Scissors className="w-8 h-8 stroke-[2]" />
            )}
          </div>
          <h3 className="text-base font-black uppercase text-stone-800">
            {activeTab === 'HISTORICO'
              ? 'Histórico Zerado'
              : 'Nenhuma bainha pendente'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum resultado corresponde à sua busca.'
              : activeTab === 'HISTORICO'
              ? 'O histórico do guasqueiro está zerado. As bainhas finalizadas aparecerão aqui.'
              : 'Tudo em dia! No momento não há pedidos com bainha a confeccionar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const bainha = extractBainhaInfo(order.services);
            if (!bainha) return null;

            const urgency = calculateUrgency(order.deliveryDate);
            const isFinalizada = order.bainhaFinalizada === true;
            const photoList =
              order.photos && order.photos.length > 0
                ? order.photos
                : order.photoUrl
                ? [order.photoUrl]
                : ['/apple-touch-icon.png'];

            const whatsAppUrl = getGuasqueiroWhatsAppUrl(order);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border-2 shadow-md overflow-hidden transition-all ${
                  isFinalizada
                    ? 'border-stone-300 bg-stone-50/50'
                    : urgency.isUrgent
                    ? 'border-amber-500 shadow-amber-500/10'
                    : 'border-stone-300'
                }`}
              >
                {/* Cabeçalho do Card */}
                <div className="p-4 bg-stone-900 text-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-amber-500 text-stone-950 font-black font-mono text-sm rounded-xl">
                      #{order.orderNumber}
                    </span>
                    <div>
                      <h3 className="font-black text-base uppercase leading-tight tracking-tight text-white">
                        {order.customerName}
                      </h3>
                      <span className="text-[11px] text-stone-400 font-medium">
                        Pedido recebido em {formatDateBR(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {isFinalizada ? (
                    <span className="px-2.5 py-1 bg-stone-800 text-amber-300 font-black text-xs uppercase rounded-xl flex items-center gap-1 border border-stone-700">
                      <Archive className="w-3.5 h-3.5" />
                      NO HISTÓRICO
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-400 text-stone-950 font-black text-xs uppercase rounded-xl flex items-center gap-1 shadow-sm">
                      <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                      A FAZER
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* 1. FOTO DA FACA (DESTAQUE MÁXIMO PARA CONFECCIONAR A BAINHA) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black uppercase text-stone-700">
                      <span>Foto da Faca ({photoList.length}):</span>
                      <span className="text-[10px] text-stone-400 font-bold">
                        Toque para dar zoom
                      </span>
                    </div>

                    <div className="relative group rounded-2xl overflow-hidden border-2 border-stone-200 bg-stone-950 max-h-64 flex items-center justify-center">
                      <img
                        src={photoList[0]}
                        alt={`Faca do Pedido #${order.orderNumber}`}
                        className="w-full h-56 sm:h-64 object-contain transition-transform group-hover:scale-[1.02] cursor-pointer"
                        onClick={() => onOpenPhoto(photoList, 0, order.customerName)}
                      />
                      <button
                        type="button"
                        onClick={() => onOpenPhoto(photoList, 0, order.customerName)}
                        className="absolute bottom-3 right-3 px-3 py-1.5 bg-stone-900/80 hover:bg-stone-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm shadow-md transition-all cursor-pointer"
                      >
                        <ZoomIn className="w-4 h-4 text-amber-400" />
                        <span>AMPLIAR FOTO</span>
                      </button>
                    </div>

                    {/* Galeria de miniaturas se houver mais de 1 foto */}
                    {photoList.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {photoList.map((photo, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => onOpenPhoto(photoList, pIdx, order.customerName)}
                            className="w-14 h-14 rounded-xl border-2 border-stone-300 hover:border-amber-500 overflow-hidden flex-shrink-0 cursor-pointer bg-stone-900"
                          >
                            <img
                              src={photo}
                              alt={`Foto ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. DADOS ESPECÍFICOS DA BAINHA (COR, MODELO, TAMANHO) */}
                  <div className="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-amber-700" />
                        DETALHES DA BAINHA:
                      </span>
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-lg uppercase ${
                          bainha.color === 'PRETA'
                            ? 'bg-stone-950 text-white'
                            : 'bg-amber-800 text-amber-100'
                        }`}
                      >
                        {bainha.color === 'PRETA' ? '⚫ COR: PRETA' : '🟤 COR: MARROM'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-3 bg-white rounded-xl border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-stone-500 block">
                          MODELO DA BAINHA:
                        </span>
                        <span className="text-sm font-black text-stone-950 uppercase mt-0.5 block">
                          {bainha.model}
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-stone-500 block">
                          COMPRIMENTO DA LÂMINA:
                        </span>
                        <span className="text-sm font-black text-amber-900 uppercase mt-0.5 block">
                          {bainha.size}
                        </span>
                      </div>
                    </div>

                    {bainha.notes && (
                      <div className="p-3 bg-white rounded-xl border border-amber-200">
                        <span className="text-[10px] font-black uppercase text-stone-500 block">
                          OBSERVAÇÕES DO CLIENTE / LOJA:
                        </span>
                        <p className="text-xs font-bold text-stone-800 mt-1 whitespace-pre-line">
                          {bainha.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 3. PRAZO DE ENTREGA & WHATSAPP DO CLIENTE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Prazo de Entrega */}
                    <div
                      className={`p-3.5 rounded-2xl border-2 space-y-1 ${
                        urgency.isOverdue
                          ? 'bg-red-50 border-red-400 text-red-950'
                          : urgency.isUrgent
                          ? 'bg-amber-50 border-amber-400 text-amber-950'
                          : 'bg-stone-50 border-stone-200 text-stone-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          PRAZO DE ENTREGA:
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            urgency.isOverdue
                              ? 'bg-red-600 text-white animate-pulse'
                              : urgency.isUrgent
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-200 text-stone-800'
                          }`}
                        >
                          {urgency.label}
                        </span>
                      </div>
                      <div className="text-base font-black font-mono">
                        {formatDateBR(order.deliveryDate)}
                      </div>
                    </div>

                    {/* WhatsApp do Cliente */}
                    <div className="p-3.5 rounded-2xl bg-stone-50 border-2 border-stone-200 space-y-1">
                      <span className="text-[11px] font-black uppercase text-stone-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-stone-700" />
                        CONTATO DO CLIENTE:
                      </span>
                      <div className="text-base font-black text-stone-900 font-mono">
                        {formatPhone(order.customerPhone || '') || 'Telefone não informado'}
                      </div>
                    </div>
                  </div>

                  {/* Botão de WhatsApp direto para o Guasqueiro */}
                  {whatsAppUrl && (
                    <a
                      href={whatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-5 h-5 flex-shrink-0" />
                      <span>FALAR COM O CLIENTE NO WHATSAPP</span>
                    </a>
                  )}

                  {/* 4. AÇÃO ÚNICA: BAINHA FINALIZADA (ENVIA PARA O HISTÓRICO) */}
                  <div className="pt-2 border-t border-stone-200">
                    {isFinalizada ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 rounded-2xl bg-stone-100 border border-stone-300">
                        <div className="flex items-center gap-2 text-stone-800 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>
                            Finalizada no seu histórico
                            {order.bainhaFinalizadaAt && (
                              <span className="font-mono ml-1 text-stone-500">
                                ({formatDateBR(order.bainhaFinalizadaAt)})
                              </span>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={processingId === order.id}
                          onClick={() => handleReabrirBainha(order)}
                          className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white hover:bg-stone-200 text-stone-800 font-black text-xs uppercase flex items-center justify-center gap-1.5 border border-stone-300 transition-all cursor-pointer"
                          title="Voltar esta bainha para a lista de A Fazer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>VOLTAR PARA A FAZER</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={processingId === order.id}
                        onClick={() => handleFinalizarBainha(order)}
                        className="w-full min-h-[64px] p-4 rounded-2xl bg-amber-800 hover:bg-amber-900 active:scale-[0.98] text-amber-100 font-black text-lg uppercase tracking-wide shadow-lg border-b-4 border-amber-950 flex flex-col sm:flex-row items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-6 h-6 stroke-[2.5] text-amber-300" />
                          <span className="text-white">
                            {processingId === order.id
                              ? 'SALVANDO...'
                              : 'BAINHA FINALIZADA'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-amber-300 normal-case opacity-90 sm:ml-1">
                          (coloca no seu histórico de bainhas)
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

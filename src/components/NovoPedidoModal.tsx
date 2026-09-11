import React, { useState, useRef, useEffect } from 'react';
import { ServiceItem } from '../types';
import { compressImage, uploadKnifePhoto } from '../services/api';
import { formatPhone, formatCurrency } from '../utils/dateUtils';
import {
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Plus,
  AlertCircle,
  Loader2,
  Trash2,
  Calendar,
  DollarSign,
  User,
  Phone,
  Scissors,
  Eye,
  Calculator,
} from 'lucide-react';

interface NovoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    services: ServiceItem[];
    totalAmount: number;
    paidAmount: number;
    isFullyPaid: boolean;
    deliveryDate: string;
    photoUrl: string;
    photos?: string[];
  }) => Promise<void>;
}

// Catálogo de serviços pré-cadastrados com valores padrão
export interface ServiceCatalogItem {
  name: string;
  defaultPrice: number;
  badge: string;
  isCombo?: boolean;
}

export const PREDEFINED_SERVICES: ServiceCatalogItem[] = [
  {
    name: 'AFIAÇÃO + POLIMENTO + PEQUENOS REPAROS',
    defaultPrice: 50,
    badge: 'R$ 50,00',
    isCombo: true,
  },
  {
    name: 'AFIAÇÃO',
    defaultPrice: 25,
    badge: 'R$ 25,00',
  },
  {
    name: 'TROCA DE CABO',
    defaultPrice: 90,
    badge: 'R$ 70 a R$ 250',
  },
  {
    name: 'BAINHA',
    defaultPrice: 70,
    badge: 'R$ 70 ou R$ 100',
  },
  {
    name: 'POLIMENTO',
    defaultPrice: 0,
    badge: 'VALOR MANUAL',
  },
  {
    name: 'PEQUENOS REPAROS',
    defaultPrice: 0,
    badge: 'VALOR MANUAL',
  },
  {
    name: 'RESTAURAÇÃO COMPLETA',
    defaultPrice: 0,
    badge: 'VALOR MANUAL',
  },
  {
    name: 'PERSONALIZAÇÃO / GRAVAÇÃO',
    defaultPrice: 0,
    badge: 'VALOR MANUAL',
  },
  {
    name: 'OUTROS SERVIÇOS',
    defaultPrice: 0,
    badge: 'VALOR MANUAL',
  },
];

// Opções de cabo com valores exatos solicitados
export const CABO_PRICE_OPTIONS = [
  { name: 'CHIFRE DE BOI', price: 90 },
  { name: 'OSSO', price: 90 },
  { name: 'MESCLADO', price: 90 },
  { name: 'HÍBRIDO', price: 120 },
  { name: 'CHIFRE DE CERVO', price: 250 },
  { name: 'MADEIRA TRADICIONAL', price: 70 },
  { name: 'MADEIRA NOBRE', price: 90 },
];

// Opções de bainha: preta ou marrom, 70 até 11" ou 100 a partir de 12"
export const BAINHA_COLORS = ['PRETA', 'MARROM'];
export const BAINHA_SIZES = [
  { label: 'ATÉ 11 POLEGADAS', price: 70 },
  { label: 'A PARTIR DE 12 POLEGADAS', price: 100 },
];

export const NovoPedidoModal: React.FC<NovoPedidoModalProps> = ({
  isOpen,
  onClose,
  onSubmitOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([
    { name: 'AFIAÇÃO', price: 25, notes: '' },
  ]);
  const [totalAmount, setTotalAmount] = useState<string>('25.00');
  const [isFullyPaid, setIsFullyPaid] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date(Date.now() + 5 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Recalcula e atualiza o total automaticamente sempre que os serviços selecionados mudarem
  useEffect(() => {
    const sum = selectedServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
  }, [selectedServices]);

  // Se já foi pago tudo, sincroniza automaticamente o valor pago com o total
  useEffect(() => {
    if (isFullyPaid) {
      setPaidAmount(totalAmount);
    }
  }, [isFullyPaid, totalAmount]);

  if (!isOpen) return null;

  // Toggle or add service
  const toggleService = (serviceName: string) => {
    const exists = selectedServices.find((s) => s.name === serviceName);
    if (exists) {
      if (selectedServices.length === 1) {
        setErrorMessage('Selecione pelo menos um serviço.');
        return;
      }
      setSelectedServices(selectedServices.filter((s) => s.name !== serviceName));
    } else {
      let defaultDetails = '';
      let defaultPrice = 0;

      if (serviceName === 'AFIAÇÃO + POLIMENTO + PEQUENOS REPAROS') {
        defaultPrice = 50;
      } else if (serviceName === 'AFIAÇÃO') {
        defaultPrice = 25;
      } else if (serviceName === 'TROCA DE CABO') {
        defaultDetails = 'CHIFRE DE BOI';
        defaultPrice = 90;
      } else if (serviceName === 'BAINHA') {
        defaultDetails = 'PRETA (ATÉ 11 POLEGADAS)';
        defaultPrice = 70;
      } else {
        const found = PREDEFINED_SERVICES.find((p) => p.name === serviceName);
        defaultPrice = found?.defaultPrice || 0;
      }

      setSelectedServices([
        ...selectedServices,
        { name: serviceName, details: defaultDetails, price: defaultPrice, notes: '' },
      ]);
      setErrorMessage(null);
    }
  };

  const updateServiceDetail = (serviceName: string, details: string) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, details } : s))
    );
  };

  const updateServicePrice = (serviceName: string, price: number) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, price } : s))
    );
  };

  const updateServiceNotes = (serviceName: string, notes: string) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, notes } : s))
    );
  };

  // Funções específicas para Troca de Cabo
  const updateCaboType = (caboName: string, price: number) => {
    setSelectedServices((prev) =>
      prev.map((s) =>
        s.name === 'TROCA DE CABO'
          ? { ...s, details: caboName, price }
          : s
      )
    );
  };

  // Funções específicas para Bainha (Preta/Marrom e Tamanho da Lâmina)
  const parseBainhaDetails = (details?: string) => {
    const d = (details || '').toUpperCase();
    const color = d.includes('MARROM') ? 'MARROM' : 'PRETA';
    const isLarge = d.includes('12 POLEGADAS') || d.includes('12"') || d.includes('A PARTIR');
    const size = isLarge ? 'A PARTIR DE 12 POLEGADAS' : 'ATÉ 11 POLEGADAS';
    return { color, size };
  };

  const updateBainha = (color: string, size: string) => {
    const price = size === 'A PARTIR DE 12 POLEGADAS' ? 100 : 70;
    setSelectedServices((prev) =>
      prev.map((s) =>
        s.name === 'BAINHA'
          ? {
              ...s,
              details: `${color} (${size})`,
              price,
            }
          : s
      )
    );
  };

  // Handle photo selection (supports 1 or multiple photos)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    if (files.length === 0) return;

    setIsProcessingPhoto(true);
    setErrorMessage(null);
    try {
      const compressedList: string[] = [];
      for (const file of files) {
        const compressed = await compressImage(file, 800, 0.72);
        compressedList.push(compressed);
      }
      setPhotos((prev) => [...prev, ...compressedList]);
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao carregar imagem. Tente novamente.');
    } finally {
      setIsProcessingPhoto(false);
      // Reset input value so user can take another photo with same input
      e.target.value = '';
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation
    if (!customerName.trim()) {
      setErrorMessage('Por favor, informe o NOME DO CLIENTE.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Por favor, informe o NÚMERO DO CLIENTE.');
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMessage('Selecione pelo menos um SERVIÇO.');
      return;
    }
    if (!deliveryDate) {
      setErrorMessage('Informe a DATA DE ENTREGA.');
      return;
    }
    if (photos.length === 0) {
      setErrorMessage('A FOTO DA FACA É OBRIGATÓRIA. Adicione pelo menos 1 foto.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload all photos
      const uploadedPhotos = await Promise.all(photos.map((p) => uploadKnifePhoto(p)));

      const numTotal = parseFloat(totalAmount.replace(',', '.')) || 0;
      let numPaid = parseFloat(paidAmount.replace(',', '.')) || 0;
      if (isFullyPaid) {
        numPaid = numTotal;
      }

      await onSubmitOrder({
        customerName: customerName.toUpperCase().trim(),
        customerPhone: customerPhone.trim(),
        services: selectedServices,
        totalAmount: numTotal,
        paidAmount: numPaid,
        isFullyPaid,
        deliveryDate,
        photoUrl: uploadedPhotos[0],
        photos: uploadedPhotos,
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar pedido.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSelectedServices([{ name: 'AFIAÇÃO', price: 25, notes: '' }]);
    setTotalAmount('25.00');
    setPaidAmount('');
    setIsFullyPaid(false);
    setPhotos([]);
    setPreviewPhotoIndex(null);
    setErrorMessage(null);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white text-stone-900 rounded-3xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-stone-300">
        {/* Header */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-amber-400 stroke-[2.5]" />
            <h2 className="text-xl font-black uppercase tracking-tight">
              NOVO PEDIDO DE FACA
            </h2>
          </div>
          <button
            id="btn-close-novo-pedido-modal"
            onClick={handleResetAndClose}
            className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* SUCCESS SCREEN */}
          {isSuccess ? (
            <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl sm:text-3xl font-black text-stone-950 uppercase">
                  PEDIDO ENVIADO PARA A CUTELARIA!
                </h3>
                <p className="text-stone-600 font-medium text-base">
                  O cuteleiro já recebeu este pedido com {photos.length} foto(s) em tempo real.
                </p>
              </div>

              <button
                id="btn-voltar-pedidos-apos-sucesso"
                onClick={handleResetAndClose}
                className="w-full py-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-stone-950 font-black text-xl uppercase tracking-wider shadow-lg border-b-4 border-amber-700 transition-all"
              >
                VOLTAR PARA PEDIDOS
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Box */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-100 border-2 border-red-500 text-red-900 font-bold text-sm flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. NOME DO CLIENTE */}
              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  NOME DO CLIENTE *
                </label>
                <input
                  id="input-customer-name"
                  type="text"
                  required
                  placeholder="DIGITE O NOME (EX: JOÃO DA SILVA)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full p-4 text-lg font-bold uppercase rounded-2xl border-2 border-stone-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200 outline-none bg-stone-50"
                />
              </div>

              {/* 2. NÚMERO DO CLIENTE */}
              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-amber-600" />
                  NÚMERO DO CLIENTE (TELEFONE / WHATSAPP) *
                </label>
                <input
                  id="input-customer-phone"
                  type="tel"
                  required
                  placeholder="(47) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  className="w-full p-4 text-lg font-bold rounded-2xl border-2 border-stone-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200 outline-none bg-stone-50"
                />
              </div>

              {/* 3. SERVIÇOS PRÉ-CADASTRADOS COM TABELA DE VALORES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-sm font-black uppercase tracking-wider text-stone-800 flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-amber-600" />
                    SERVIÇOS (SELECIONE UM OU MAIS) *
                  </label>
                  <span className="text-xs text-stone-600 font-bold bg-stone-100 px-2.5 py-1 rounded-full border border-stone-300">
                    {selectedServices.length} selecionado(s)
                  </span>
                </div>

                {/* Chips of services with badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {PREDEFINED_SERVICES.map((srv) => {
                    const isSelected = selectedServices.some((s) => s.name === srv.name);
                    return (
                      <button
                        key={srv.name}
                        id={`btn-service-${srv.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        type="button"
                        onClick={() => toggleService(srv.name)}
                        className={`p-3 rounded-2xl font-black text-xs uppercase tracking-wide border-2 transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 border-amber-600 text-stone-950 shadow-md scale-[1.02]'
                            : 'bg-stone-50 border-stone-300 text-stone-800 hover:bg-stone-100 hover:border-stone-400'
                        }`}
                      >
                        <span className="leading-tight">{srv.name}</span>
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-stone-950 text-amber-300 font-black'
                              : 'bg-stone-200 text-stone-700 font-bold'
                          }`}
                        >
                          {srv.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Details, options & individual prices for selected services */}
                <div className="space-y-3 pt-2">
                  {selectedServices.map((srv) => (
                    <div
                      key={srv.name}
                      className="p-3.5 bg-stone-50 rounded-2xl border-2 border-stone-300 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-stone-950 uppercase tracking-tight">
                            SERVIÇO: {srv.name}
                          </span>
                          {srv.price !== undefined && srv.price > 0 && (
                            <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                              {formatCurrency(srv.price)}
                            </span>
                          )}
                        </div>
                        {selectedServices.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleService(srv.name)}
                            className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> REMOVER
                          </button>
                        )}
                      </div>

                      {/* Special options for TROCA DE CABO */}
                      {srv.name === 'TROCA DE CABO' && (
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase text-stone-700 block">
                            TIPO DE CABO (VALORES DEFINIDOS):
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {CABO_PRICE_OPTIONS.map((cabo) => {
                              const isCaboActive = srv.details === cabo.name;
                              return (
                                <button
                                  key={cabo.name}
                                  type="button"
                                  onClick={() => updateCaboType(cabo.name, cabo.price)}
                                  className={`p-2 rounded-xl text-xs font-black uppercase border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                                    isCaboActive
                                      ? 'bg-stone-950 text-amber-400 border-stone-950 shadow-sm'
                                      : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                                  }`}
                                >
                                  <span>{cabo.name}</span>
                                  <span
                                    className={`text-[11px] font-mono mt-0.5 font-bold ${
                                      isCaboActive ? 'text-emerald-300' : 'text-stone-500'
                                    }`}
                                  >
                                    R$ {cabo.price},00
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="pt-1">
                            <input
                              type="text"
                              placeholder="Ou digite outro tipo de cabo personalizado..."
                              value={
                                CABO_PRICE_OPTIONS.some((c) => c.name === srv.details)
                                  ? ''
                                  : srv.details || ''
                              }
                              onChange={(e) => {
                                const customName = e.target.value.toUpperCase();
                                setSelectedServices((prev) =>
                                  prev.map((s) =>
                                    s.name === 'TROCA DE CABO'
                                      ? { ...s, details: customName }
                                      : s
                                  )
                                );
                              }}
                              className="w-full p-2.5 text-xs font-bold uppercase rounded-xl border border-stone-300 bg-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* Special options for BAINHA */}
                      {srv.name === 'BAINHA' && (
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-xs font-black uppercase text-stone-700 block mb-1">
                              1. COR DA BAINHA:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {BAINHA_COLORS.map((cor) => {
                                const { color: currColor, size: currSize } = parseBainhaDetails(
                                  srv.details
                                );
                                const isColorSelected = currColor === cor;
                                return (
                                  <button
                                    key={cor}
                                    type="button"
                                    onClick={() => updateBainha(cor, currSize)}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                      isColorSelected
                                        ? 'bg-stone-950 text-amber-400 border-stone-950 shadow-sm'
                                        : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                                    }`}
                                  >
                                    <span>{cor === 'PRETA' ? '⚫' : '🟤'}</span>
                                    <span>BAINHA {cor}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-black uppercase text-stone-700 block mb-1">
                              2. COMPRIMENTO DA LÂMINA:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {BAINHA_SIZES.map((tamanho) => {
                                const { color: currColor, size: currSize } = parseBainhaDetails(
                                  srv.details
                                );
                                const isSizeSelected = currSize === tamanho.label;
                                return (
                                  <button
                                    key={tamanho.label}
                                    type="button"
                                    onClick={() => updateBainha(currColor, tamanho.label)}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                                      isSizeSelected
                                        ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-sm'
                                        : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                                    }`}
                                  >
                                    <span>{tamanho.label}</span>
                                    <span className="text-[11px] font-mono font-black mt-0.5">
                                      R$ {tamanho.price},00
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Campo editável de valor deste serviço */}
                      <div className="p-2.5 bg-stone-100/90 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-black uppercase text-stone-700 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-amber-700" />
                          VALOR DESTE SERVIÇO:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-stone-500">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={srv.price !== undefined ? srv.price : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateServicePrice(srv.name, isNaN(val) ? 0 : val);
                            }}
                            className="w-28 p-1.5 text-sm font-black font-mono text-stone-950 text-right bg-white rounded-lg border-2 border-stone-300 focus:border-amber-500 outline-none"
                          />
                        </div>
                      </div>

                      {/* Observação específica para o serviço */}
                      <div>
                        <input
                          type="text"
                          placeholder={`Observação específica para ${srv.name} (opcional)`}
                          value={srv.notes || ''}
                          onChange={(e) => updateServiceNotes(srv.name, e.target.value.toUpperCase())}
                          className="w-full p-2.5 text-xs font-semibold uppercase rounded-xl border border-stone-300 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. VALORES E CÁLCULO DO TOTAL EM TEMPO REAL */}
              <div className="p-4 bg-amber-50/80 rounded-3xl border-2 border-amber-300 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black uppercase tracking-wider text-stone-950 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-amber-600" />
                    VALORES E PAGAMENTO DO PEDIDO
                  </label>
                  <span className="text-[11px] font-black uppercase bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Cálculo Automático
                  </span>
                </div>

                {/* Resumo detalhado dos serviços e valores antes de fechar */}
                <div className="p-3.5 bg-white rounded-2xl border border-amber-200 space-y-2">
                  <span className="text-xs font-black uppercase text-stone-600 block">
                    DISCRIMINAÇÃO DOS SERVIÇOS:
                  </span>
                  <div className="space-y-1.5 divide-y divide-stone-100">
                    {selectedServices.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 pt-1.5 first:pt-0"
                      >
                        <div className="font-bold text-stone-800 uppercase flex items-center gap-1.5 flex-wrap">
                          <span className="text-amber-600 font-black">•</span>
                          <span>{s.name}</span>
                          {s.details && (
                            <span className="text-[11px] text-stone-500 font-semibold">
                              ({s.details})
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-black text-stone-950 ml-2">
                          {formatCurrency(s.price || 0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total geral atualizado */}
                  <div className="pt-2 border-t-2 border-amber-100 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-800">
                      TOTAL ATUALIZADO:
                    </span>
                    <span className="font-mono text-xl font-black text-stone-950">
                      {formatCurrency(parseFloat(totalAmount) || 0)}
                    </span>
                  </div>
                </div>

                {/* Campos de Valor Total e Pagamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-stone-700 uppercase flex items-center justify-between">
                      <span>VALOR TOTAL (R$)</span>
                      <span className="text-[10px] text-stone-500 font-medium">Ajustável manual</span>
                    </span>
                    <input
                      id="input-total-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full p-3 font-mono font-black text-lg rounded-xl border-2 border-amber-400 bg-white focus:outline-none focus:border-amber-600 shadow-sm"
                    />
                  </div>

                  <div className="flex flex-col justify-end space-y-1">
                    <button
                      id="btn-toggle-fully-paid"
                      type="button"
                      onClick={() => {
                        const next = !isFullyPaid;
                        setIsFullyPaid(next);
                        if (next) {
                          setPaidAmount(totalAmount);
                        }
                      }}
                      className={`w-full p-3 rounded-xl font-black text-xs uppercase tracking-wide border-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isFullyPaid
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-md'
                          : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${isFullyPaid ? 'text-white' : 'text-stone-400'}`} />
                      {isFullyPaid ? '✅ JÁ FOI PAGO TUDO' : 'AINDA NÃO FOI PAGO TUDO'}
                    </button>
                  </div>
                </div>

                {!isFullyPaid && (
                  <div className="pt-1 space-y-2">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-stone-700 uppercase">
                        VALOR DADO DE ENTRADA (R$)
                      </span>
                      <input
                        id="input-paid-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="w-full p-3 font-mono font-bold text-base rounded-xl border-2 border-stone-300 bg-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    {totalAmount && (
                      <div className="p-2.5 bg-stone-900 text-white rounded-xl flex items-center justify-between text-xs font-black uppercase">
                        <span className="text-amber-400">RESTANTE A PAGAR NA ENTREGA:</span>
                        <span className="font-mono text-sm text-white">
                          {formatCurrency(
                            Math.max(
                              0,
                              (parseFloat(totalAmount) || 0) - (parseFloat(paidAmount) || 0)
                            )
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. DATA DE ENTREGA */}
              <div className="space-y-1.5">
                <label className="text-sm font-black uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  DATA DE ENTREGA *
                </label>
                <input
                  id="input-delivery-date"
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full p-4 text-lg font-bold rounded-2xl border-2 border-stone-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-200 outline-none bg-stone-50"
                />
              </div>

              {/* 6. FOTOS DA FACA (SUPORTA UMA OU MAIS FOTOS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black uppercase tracking-wider text-stone-900 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-amber-600" />
                    FOTOS DA FACA (PODE ENVIAR VÁRIAS) *
                  </label>
                  {photos.length > 0 && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-mono font-black text-xs rounded-full border border-amber-300">
                      {photos.length} FOTO{photos.length > 1 ? 'S' : ''}
                    </span>
                  )}
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Big Camera & Gallery Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    id="btn-tirar-foto-faca"
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="p-4 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-98 text-amber-400 font-black text-base uppercase flex items-center justify-center gap-3 border-2 border-stone-950 shadow-md transition-all"
                  >
                    <Camera className="w-6 h-6 stroke-[2.5]" />
                    <span>{photos.length === 0 ? '📷 TIRAR FOTO DA FACA' : '📷 + TIRAR OUTRA FOTO'}</span>
                  </button>

                  <button
                    id="btn-escolher-galeria"
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="p-4 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-800 font-bold text-base uppercase flex items-center justify-center gap-3 border-2 border-stone-300 transition-all"
                  >
                    <ImageIcon className="w-6 h-6" />
                    <span>{photos.length === 0 ? '🖼️ GALERIA (VÁRIAS)' : '🖼️ + FOTOS DA GALERIA'}</span>
                  </button>
                </div>

                {/* Processing State */}
                {isProcessingPhoto && (
                  <div className="p-6 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-300">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
                    <span className="text-sm font-bold text-stone-700">
                      Processando e otimizando a(s) foto(s)...
                    </span>
                  </div>
                )}

                {/* Photos Grid */}
                {photos.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-bold uppercase text-stone-600">
                      FOTOS ADICIONADAS ({photos.length}) — Toque para visualizar ou adicionar mais:
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {photos.map((p, index) => (
                        <div
                          key={index}
                          className="relative rounded-2xl overflow-hidden border-2 border-stone-300 aspect-square bg-stone-900 group shadow-sm"
                        >
                          <img
                            src={p}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setPreviewPhotoIndex(index)}
                          />

                          {/* Index / Principal badge */}
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/75 text-white text-[10px] font-mono font-bold">
                            {index === 0 ? '⭐ PRINCIPAL' : `#${index + 1}`}
                          </div>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-md active:scale-90"
                            title="Remover foto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Zoom tap hint */}
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoIndex(index)}
                            className="absolute bottom-2 inset-x-2 py-1 bg-black/70 hover:bg-black/90 text-amber-300 text-[10px] font-black uppercase rounded-lg text-center flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> VER
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. GIANT SUBMIT BUTTON */}
              <div className="pt-4">
                <button
                  id="btn-enviar-pedido-submit"
                  type="submit"
                  disabled={isSubmitting || isProcessingPhoto}
                  className="w-full min-h-[72px] p-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-stone-950 font-black text-2xl uppercase tracking-wider shadow-xl border-b-4 border-amber-700 flex items-center justify-center gap-3 transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span>SALVANDO PEDIDO COM {photos.length} FOTO(S)...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-7 h-7 stroke-[2.5]" />
                      <span>ENVIAR PEDIDO</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Internal preview for modal */}
      {previewPhotoIndex !== null && photos[previewPhotoIndex] && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-between p-4"
          onClick={() => setPreviewPhotoIndex(null)}
        >
          <div className="w-full flex justify-between items-center text-white max-w-xl">
            <span className="font-bold text-sm">
              FOTO {previewPhotoIndex + 1} DE {photos.length}
            </span>
            <button
              onClick={() => setPreviewPhotoIndex(null)}
              className="p-2 bg-stone-800 rounded-full text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="max-h-[80vh] flex items-center justify-center">
            <img
              src={photos[previewPhotoIndex]}
              alt="Pré-visualização"
              className="max-h-full max-w-full object-contain rounded-xl"
            />
          </div>
          <button
            onClick={() => setPreviewPhotoIndex(null)}
            className="w-full max-w-xs py-3 bg-stone-800 text-white font-bold rounded-xl"
          >
            FECHAR VISUALIZAÇÃO
          </button>
        </div>
      )}
    </div>
  );
};

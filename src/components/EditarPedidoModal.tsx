import React, { useState, useRef, useEffect } from 'react';
import { Order, ServiceItem } from '../types';
import { compressImage } from '../services/api';
import { formatPhone, formatCurrency } from '../utils/dateUtils';
import {
  PREDEFINED_SERVICES,
  CABO_PRICE_OPTIONS,
  BAINHA_COLORS,
  BAINHA_SIZES,
} from './NovoPedidoModal';
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
  Save,
} from 'lucide-react';

interface EditarPedidoModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onSaveOrder: (orderId: string, updatedData: Partial<Order>) => Promise<void>;
}

export const EditarPedidoModal: React.FC<EditarPedidoModalProps> = ({
  isOpen,
  order,
  onClose,
  onSaveOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [isFullyPaid, setIsFullyPaid] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Inicializa os campos quando o pedido a ser editado muda
  useEffect(() => {
    if (order && isOpen) {
      setCustomerName(order.customerName || '');
      setCustomerPhone(order.customerPhone || '');
      const initialServices: ServiceItem[] =
        order.services && order.services.length > 0
          ? JSON.parse(JSON.stringify(order.services))
          : [{ name: 'AFIAÇÃO', price: 25, notes: '' }];
      setSelectedServices(initialServices);
      setTotalAmount(order.totalAmount ? String(order.totalAmount) : '');
      setIsFullyPaid(Boolean(order.isFullyPaid));
      setPaidAmount(order.paidAmount ? String(order.paidAmount) : '');
      setDeliveryDate(order.deliveryDate || '');

      const initialPhotos =
        order.photos && order.photos.length > 0
          ? [...order.photos]
          : order.photoUrl
          ? [order.photoUrl]
          : [];
      setPhotos(initialPhotos);
      setErrorMessage(null);
      setIsSuccess(false);
      setPreviewPhotoIndex(null);
    }
  }, [order, isOpen]);

  // Se já foi pago tudo, sincroniza automaticamente o valor pago com o total
  useEffect(() => {
    if (isFullyPaid) {
      setPaidAmount(totalAmount);
    }
  }, [isFullyPaid, totalAmount]);

  if (!isOpen || !order) return null;

  // Recalcular soma dos serviços
  const handleRecalculateTotal = () => {
    const sum = selectedServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
  };

  // Toggle or add service
  const toggleService = (serviceName: string) => {
    const exists = selectedServices.find((s) => s.name === serviceName);
    if (exists) {
      if (selectedServices.length === 1) {
        setErrorMessage('O pedido deve conter pelo menos um serviço.');
        return;
      }
      const updated = selectedServices.filter((s) => s.name !== serviceName);
      setSelectedServices(updated);
      const sum = updated.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
      setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
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

      const updated = [
        ...selectedServices,
        { name: serviceName, details: defaultDetails, price: defaultPrice, notes: '' },
      ];
      setSelectedServices(updated);
      const sum = updated.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
      setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
      setErrorMessage(null);
    }
  };

  const updateServiceDetail = (serviceName: string, details: string) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, details } : s))
    );
  };

  const updateServicePrice = (serviceName: string, price: number) => {
    const updated = selectedServices.map((s) =>
      s.name === serviceName ? { ...s, price } : s
    );
    setSelectedServices(updated);
    const sum = updated.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
  };

  const updateServiceNotes = (serviceName: string, notes: string) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, notes } : s))
    );
  };

  // Troca de Cabo
  const updateCaboType = (caboName: string, price: number) => {
    const updated = selectedServices.map((s) =>
      s.name === 'TROCA DE CABO'
        ? { ...s, details: caboName, price }
        : s
    );
    setSelectedServices(updated);
    const sum = updated.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
  };

  // Bainha
  const parseBainhaDetails = (details?: string) => {
    const d = (details || '').toUpperCase();
    const color = d.includes('MARROM') ? 'MARROM' : 'PRETA';
    const isLarge = d.includes('12 POLEGADAS') || d.includes('12"') || d.includes('A PARTIR');
    const size = isLarge ? 'A PARTIR DE 12 POLEGADAS' : 'ATÉ 11 POLEGADAS';
    return { color, size };
  };

  const updateBainha = (color: string, size: string) => {
    const price = size === 'A PARTIR DE 12 POLEGADAS' ? 100 : 70;
    const updated = selectedServices.map((s) =>
      s.name === 'BAINHA'
        ? {
            ...s,
            details: `${color} (${size})`,
            price,
          }
        : s
    );
    setSelectedServices(updated);
    const sum = updated.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    setTotalAmount(sum > 0 ? sum.toFixed(2) : '');
  };

  // Adicionar fotos
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
      e.target.value = '';
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validações
    if (!customerName.trim()) {
      setErrorMessage('Por favor, informe o NOME DO CLIENTE.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Por favor, informe o TELEFONE DO CLIENTE.');
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
      setErrorMessage('A FOTO DA FACA É OBRIGATÓRIA. Mantenha pelo menos 1 foto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTotal = parseFloat(totalAmount) || 0;
      const parsedPaid = isFullyPaid ? parsedTotal : parseFloat(paidAmount) || 0;

      const updatedPayload: Partial<Order> = {
        customerName: customerName.toUpperCase().trim(),
        customerPhone: customerPhone.trim(),
        services: selectedServices,
        totalAmount: parsedTotal,
        paidAmount: parsedPaid,
        isFullyPaid: isFullyPaid,
        deliveryDate: deliveryDate,
        photoUrl: photos[0],
        photos: photos,
      };

      await onSaveOrder(order.id, updatedPayload);

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage('Erro ao salvar alterações no pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTotalNumber = parseFloat(totalAmount) || 0;
  const currentPaidNumber = isFullyPaid ? currentTotalNumber : parseFloat(paidAmount) || 0;
  const remainingNumber = Math.max(0, currentTotalNumber - currentPaidNumber);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 text-stone-100 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border-4 border-amber-500 my-auto animate-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b-2 border-stone-800 flex items-start justify-between gap-3 bg-stone-950/60 rounded-t-3xl flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-stone-950 font-black text-xs font-mono uppercase">
                PEDIDO #{order.orderNumber}
              </span>
              <span className="text-xs text-stone-400 font-bold uppercase">
                Status: {order.status}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-amber-400 uppercase tracking-tight mt-1">
              EDITAR ENVIO DE PEDIDO
            </h2>
            <p className="text-xs text-stone-300 font-medium">
              As alterações são atualizadas automaticamente na bancada do cuteleiro.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-all cursor-pointer flex-shrink-0"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5 space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-red-950/90 border-2 border-red-500 rounded-2xl flex items-center gap-2.5 text-red-200 text-sm font-bold">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div className="p-4 bg-emerald-950/90 border-2 border-emerald-500 rounded-2xl flex items-center gap-2.5 text-emerald-200 text-base font-black uppercase text-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span>PEDIDO ATUALIZADO COM SUCESSO!</span>
            </div>
          )}

          {/* 1. FOTOS DA FACA */}
          <div className="space-y-2.5 bg-stone-950/50 p-3.5 rounded-2xl border border-stone-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-500" />
                FOTOS DA FACA ({photos.length})
              </label>
              <span className="text-[11px] font-bold text-stone-400">
                Pelo menos 1 foto obrigatória
              </span>
            </div>

            {/* Photos Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-stone-700 bg-stone-900 group"
                  >
                    <img
                      src={photo}
                      alt={`Faca ${index + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewPhotoIndex(index)}
                    />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-[10px] font-mono font-bold text-amber-300 rounded">
                      #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-md transition-all cursor-pointer"
                      title="Excluir foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons to add more photos */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 active:scale-98 text-amber-300 font-black text-xs uppercase rounded-xl border border-stone-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>TIRAR OUTRA FOTO</span>
              </button>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 active:scale-98 text-stone-200 font-black text-xs uppercase rounded-xl border border-stone-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <ImageIcon className="w-4 h-4 text-stone-400" />
                <span>+ FOTO DA GALERIA</span>
              </button>
            </div>

            {isProcessingPhoto && (
              <div className="flex items-center justify-center gap-2 p-2 bg-stone-900 rounded-xl text-xs text-amber-300 font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Comprimindo e otimizando imagem...</span>
              </div>
            )}
          </div>

          {/* 2. DADOS DO CLIENTE */}
          <div className="space-y-3 bg-stone-950/50 p-3.5 rounded-2xl border border-stone-800">
            <label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-500" />
              DADOS DO CLIENTE
            </label>

            <div>
              <label className="text-[11px] font-black uppercase text-stone-400 block mb-1">
                NOME COMPLETO DO CLIENTE:
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="EX: JOÃO DA SILVA"
                className="w-full px-3.5 py-3 bg-stone-900 border-2 border-stone-700 focus:border-amber-500 rounded-xl font-black text-stone-100 uppercase text-base placeholder-stone-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-stone-400 block mb-1">
                TELEFONE / WHATSAPP DO CLIENTE:
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  placeholder="(67) 99999-9999"
                  className="w-full pl-10 pr-3.5 py-3 bg-stone-900 border-2 border-stone-700 focus:border-amber-500 rounded-xl font-mono font-bold text-stone-100 text-base placeholder-stone-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. SERVIÇOS SOLICITADOS COM TABELA DE VALORES */}
          <div className="space-y-3 bg-stone-950/50 p-3.5 rounded-2xl border border-stone-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-amber-500" />
                SERVIÇOS SOLICITADOS ({selectedServices.length})
              </label>
              <button
                type="button"
                onClick={handleRecalculateTotal}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                Recalcular Total
              </button>
            </div>

            {/* Catálogo de serviços com botões rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PREDEFINED_SERVICES.map((item) => {
                const isSelected = selectedServices.some((s) => s.name === item.name);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => toggleService(item.name)}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm font-black'
                        : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-stone-950 border-stone-950 text-amber-400'
                            : 'border-stone-600 bg-stone-800'
                        }`}
                      >
                        {isSelected && <span className="text-xs leading-none">✓</span>}
                      </div>
                      <span className="text-xs font-black uppercase leading-tight">
                        {item.name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded flex-shrink-0 ${
                        isSelected
                          ? 'bg-stone-950/20 text-stone-950 border border-stone-950/30'
                          : 'bg-stone-800 text-amber-400 border border-stone-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Customização dos serviços selecionados */}
            <div className="space-y-3 pt-2">
              {selectedServices.map((srv, index) => {
                const isCabo = srv.name === 'TROCA DE CABO';
                const isBainha = srv.name === 'BAINHA';
                const bainhaData = isBainha ? parseBainhaDetails(srv.details) : null;

                return (
                  <div
                    key={index}
                    className="p-3 bg-stone-900 rounded-xl border-2 border-stone-700 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-black text-amber-400 uppercase">
                        • {srv.name}
                      </span>

                      {/* Campo de Preço do Serviço */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-400 uppercase">
                          Valor (R$):
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={srv.price !== undefined ? srv.price : ''}
                          onChange={(e) =>
                            updateServicePrice(srv.name, parseFloat(e.target.value) || 0)
                          }
                          placeholder="0,00"
                          className="w-24 px-2.5 py-1 bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-lg text-right font-mono font-black text-amber-300 text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Opções de Cabo */}
                    {isCabo && (
                      <div className="p-2.5 bg-stone-950 rounded-xl border border-stone-800 space-y-2">
                        <span className="text-[11px] font-black uppercase text-amber-400 block">
                          SELECIONE O TIPO DE CABO:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CABO_PRICE_OPTIONS.map((cabo) => {
                            const isSelected = srv.details === cabo.name;
                            return (
                              <button
                                key={cabo.name}
                                type="button"
                                onClick={() => updateCaboType(cabo.name, cabo.price)}
                                className={`p-2 rounded-lg text-left text-xs font-bold transition-all border flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-black'
                                    : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
                                }`}
                              >
                                <span className="truncate">{cabo.name}</span>
                                <span className="font-mono text-[11px] ml-1">
                                  R$ {cabo.price}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Opções de Bainha */}
                    {isBainha && bainhaData && (
                      <div className="p-2.5 bg-stone-950 rounded-xl border border-stone-800 space-y-2.5">
                        <div>
                          <span className="text-[11px] font-black uppercase text-amber-400 block mb-1">
                            COR DA BAINHA:
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {BAINHA_COLORS.map((cor) => {
                              const isSelected = bainhaData.color === cor;
                              return (
                                <button
                                  key={cor}
                                  type="button"
                                  onClick={() => updateBainha(cor, bainhaData.size)}
                                  className={`py-1.5 px-2 rounded-lg text-xs font-black uppercase border transition-all ${
                                    isSelected
                                      ? 'bg-amber-500 text-stone-950 border-amber-400'
                                      : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
                                  }`}
                                >
                                  {cor}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-black uppercase text-amber-400 block mb-1">
                            TAMANHO DA LÂMINA:
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {BAINHA_SIZES.map((tamanho) => {
                              const isSelected = bainhaData.size === tamanho.label;
                              return (
                                <button
                                  key={tamanho.label}
                                  type="button"
                                  onClick={() => updateBainha(bainhaData.color, tamanho.label)}
                                  className={`py-2 px-2 rounded-lg text-left text-xs font-bold border transition-all flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-black'
                                      : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
                                  }`}
                                >
                                  <span className="text-[11px]">{tamanho.label}</span>
                                  <span className="font-mono font-black text-xs ml-1">
                                    R$ {tamanho.price}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Especificação livre ou detalhes adicionais */}
                    {!isCabo && !isBainha && (
                      <input
                        type="text"
                        value={srv.details || ''}
                        onChange={(e) => updateServiceDetail(srv.name, e.target.value)}
                        placeholder="Especificação ou detalhes extras do serviço..."
                        className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 focus:border-amber-400 rounded-lg text-xs font-bold text-stone-200 placeholder-stone-600 focus:outline-none"
                      />
                    )}

                    {/* Observações específicas deste serviço */}
                    <input
                      type="text"
                      value={srv.notes || ''}
                      onChange={(e) => updateServiceNotes(srv.name, e.target.value)}
                      placeholder="Observação para o cuteleiro sobre este serviço..."
                      className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 focus:border-amber-400 rounded-lg text-xs text-stone-300 placeholder-stone-600 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. DISCRIMINAÇÃO E VALORES */}
          <div className="space-y-3 bg-stone-950/50 p-3.5 rounded-2xl border border-stone-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-500" />
                VALOR TOTAL E PAGAMENTO
              </label>
              <button
                type="button"
                onClick={handleRecalculateTotal}
                className="text-[11px] font-bold text-stone-400 hover:text-amber-300 underline cursor-pointer"
              >
                Atualizar pelo Serviços
              </button>
            </div>

            {/* Discriminação dos itens com subtotal */}
            <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-stone-400 block border-b border-stone-800 pb-1">
                DISCRIMINAÇÃO DOS SERVIÇOS:
              </span>
              <div className="space-y-1">
                {selectedServices.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs font-bold text-stone-300"
                  >
                    <span>
                      • {s.name} {s.details ? `(${s.details})` : ''}
                    </span>
                    <span className="font-mono text-amber-400">
                      {formatCurrency(s.price || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Campo de Valor Total */}
            <div>
              <label className="text-[11px] font-black uppercase text-stone-400 block mb-1">
                VALOR TOTAL COBRADO (R$):
              </label>
              <div className="relative">
                <DollarSign className="w-5 h-5 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-3 bg-stone-900 border-2 border-stone-700 focus:border-amber-400 rounded-xl font-mono text-xl font-black text-amber-300 placeholder-stone-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Já pago tudo? */}
            <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-stone-200 block">
                  PAGAMENTO INTEGRAL ANTECIPADO?
                </span>
                <span className="text-[11px] text-stone-400 font-medium">
                  {isFullyPaid
                    ? 'Cliente já pagou o valor total'
                    : 'Cliente pagou apenas entrada ou pagará na entrega'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFullyPaid(!isFullyPaid)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border cursor-pointer ${
                  isFullyPaid
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}
              >
                {isFullyPaid ? '✓ JÁ PAGO TUDO' : 'NÃO PAGO TUDO'}
              </button>
            </div>

            {/* Se não pago tudo, campo de entrada */}
            {!isFullyPaid && (
              <div>
                <label className="text-[11px] font-black uppercase text-stone-400 block mb-1">
                  VALOR DE ENTRADA JÁ PAGO (R$):
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0,00 (deixe vazio se for pagar tudo na entrega)"
                    className="w-full pl-9 pr-3 py-2 bg-stone-900 border border-stone-700 focus:border-amber-400 rounded-xl font-mono font-bold text-stone-100 text-sm placeholder-stone-600 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-center text-xs mt-1 px-1">
                  <span className="text-stone-400 font-bold">Resta a pagar na entrega:</span>
                  <span className="font-mono font-black text-amber-400">
                    {formatCurrency(remainingNumber)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 5. DATA DE ENTREGA */}
          <div className="space-y-2 bg-stone-950/50 p-3.5 rounded-2xl border border-stone-800">
            <label className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              DATA DE ENTREGA DA FACA:
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-4 py-3 bg-stone-900 border-2 border-stone-700 focus:border-amber-400 rounded-xl font-mono font-black text-stone-100 text-base focus:outline-none"
            />
          </div>

          {/* PREVIEW PHOTO EXPANDED */}
          {previewPhotoIndex !== null && (
            <div
              className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
              onClick={() => setPreviewPhotoIndex(null)}
            >
              <div className="relative max-w-lg w-full max-h-[85vh] flex items-center justify-center">
                <img
                  src={photos[previewPhotoIndex]}
                  alt="Foto da faca ampliada"
                  className="max-w-full max-h-[85vh] object-contain rounded-2xl border-2 border-stone-700"
                />
                <button
                  type="button"
                  onClick={() => setPreviewPhotoIndex(null)}
                  className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[64px] p-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-black text-lg sm:text-xl uppercase rounded-2xl shadow-xl border-b-4 border-amber-700 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>SALVANDO ALTERAÇÕES...</span>
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  <span>SALVAR ALTERAÇÕES NO PEDIDO</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

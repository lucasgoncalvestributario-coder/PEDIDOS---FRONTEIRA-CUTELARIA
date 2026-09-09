import React, { useState, useRef } from 'react';
import { ServiceItem } from '../types';
import { compressImage, uploadKnifePhoto } from '../services/api';
import { formatPhone } from '../utils/dateUtils';
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

// Pre-registered services in CAIXA ALTA
const PREDEFINED_SERVICES = [
  'AFIAÇÃO',
  'RESTAURAÇÃO',
  'POLIMENTO',
  'TROCA DE CABO',
  'BAINHA',
  'PERSONALIZAÇÃO',
  'GRAVAÇÃO',
  'MANUTENÇÃO',
  'OUTRO',
];

// Quick options for TROCA DE CABO
const CABO_OPTIONS = [
  'CHIFRE DE BOI',
  'CHIFRE DE CERVO',
  'OSSO',
  'CANELA DE OVELHA',
  'MADEIRA NOBRE',
  'MADEIRA TRADICIONAL',
  'RESINA',
  'ZAMAC',
];

// Quick options for BAINHA (somente preta ou marrom)
const BAINHA_OPTIONS = [
  'PRETA',
  'MARROM',
];

export const NovoPedidoModal: React.FC<NovoPedidoModalProps> = ({
  isOpen,
  onClose,
  onSubmitOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([
    { name: 'AFIAÇÃO', notes: '' },
  ]);
  const [totalAmount, setTotalAmount] = useState<string>('');
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
      if (serviceName === 'BAINHA') defaultDetails = 'PRETA';
      if (serviceName === 'TROCA DE CABO') defaultDetails = 'CHIFRE DE CERVO';
      setSelectedServices([...selectedServices, { name: serviceName, details: defaultDetails, notes: '' }]);
      setErrorMessage(null);
    }
  };

  const updateServiceDetail = (serviceName: string, details: string) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, details } : s))
    );
  };

  const updateServiceNotes = (serviceName: string, notes: string) => {
    setSelectedServices(
      selectedServices.map((s) => (s.name === serviceName ? { ...s, notes } : s))
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
    setSelectedServices([{ name: 'AFIAÇÃO', notes: '' }]);
    setTotalAmount('');
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

              {/* 3. SERVIÇOS PRÉ-CADASTRADOS */}
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-wider text-stone-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-amber-600" />
                    SERVIÇOS (SELECIONE UM OU MAIS) *
                  </span>
                  <span className="text-xs text-stone-500 font-normal">
                    {selectedServices.length} selecionado(s)
                  </span>
                </label>

                {/* Chips of services */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PREDEFINED_SERVICES.map((srv) => {
                    const isSelected = selectedServices.some((s) => s.name === srv);
                    return (
                      <button
                        key={srv}
                        id={`btn-service-${srv.toLowerCase().replace(/\s+/g, '-')}`}
                        type="button"
                        onClick={() => toggleService(srv)}
                        className={`p-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide border-2 transition-all flex items-center justify-center text-center ${
                          isSelected
                            ? 'bg-amber-500 border-amber-600 text-stone-950 shadow-sm scale-[1.02]'
                            : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {srv}
                      </button>
                    );
                  })}
                </div>

                {/* Details & notes for selected services */}
                <div className="space-y-3 pt-2">
                  {selectedServices.map((srv) => (
                    <div
                      key={srv.name}
                      className="p-3 bg-stone-50 rounded-2xl border-2 border-stone-200 space-y-2"
                    >
                      <div className="flex items-center justify-between font-black text-sm text-stone-900 uppercase">
                        <span>SERVIÇO: {srv.name}</span>
                        {selectedServices.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleService(srv.name)}
                            className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1 font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> REMOVER
                          </button>
                        )}
                      </div>

                      {/* Special options for TROCA DE CABO */}
                      {srv.name === 'TROCA DE CABO' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-stone-600">
                            TIPO DE CABO:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {CABO_OPTIONS.map((cabo) => (
                              <button
                                key={cabo}
                                type="button"
                                onClick={() => updateServiceDetail(srv.name, cabo)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase border ${
                                  srv.details === cabo
                                    ? 'bg-stone-900 text-amber-400 border-stone-900'
                                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                                }`}
                              >
                                {cabo}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Ou digite outro tipo de cabo..."
                            value={srv.details || ''}
                            onChange={(e) => updateServiceDetail(srv.name, e.target.value.toUpperCase())}
                            className="w-full p-2.5 text-xs font-bold uppercase rounded-xl border border-stone-300 bg-white"
                          />
                        </div>
                      )}

                      {/* Special options for BAINHA */}
                      {srv.name === 'BAINHA' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-stone-600">
                            COR DA BAINHA (ESCOLHA PRETA OU MARROM):
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {BAINHA_OPTIONS.map((bainha) => (
                              <button
                                key={bainha}
                                type="button"
                                onClick={() => updateServiceDetail(srv.name, bainha)}
                                className={`py-3 rounded-xl text-sm font-black uppercase border-2 transition-all ${
                                  (srv.details || 'PRETA') === bainha
                                    ? 'bg-stone-900 text-amber-400 border-stone-900 shadow-sm scale-[1.02]'
                                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                                }`}
                              >
                                {bainha}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* General observation note for this service */}
                      <div>
                        <input
                          type="text"
                          placeholder={`OBSERVAÇÃO PARA ${srv.name} (OPCIONAL)`}
                          value={srv.notes || ''}
                          onChange={(e) => updateServiceNotes(srv.name, e.target.value.toUpperCase())}
                          className="w-full p-2.5 text-xs font-semibold uppercase rounded-xl border border-stone-300 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. VALORES */}
              <div className="p-4 bg-amber-50/70 rounded-2xl border-2 border-amber-200 space-y-3">
                <label className="text-sm font-black uppercase tracking-wider text-stone-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-700" />
                  VALORES E PAGAMENTO
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-stone-700 uppercase">
                      VALOR TOTAL COBRADO (R$)
                    </span>
                    <input
                      id="input-total-amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full p-3 font-bold text-base rounded-xl border-2 border-amber-300 bg-white focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="flex flex-col justify-end space-y-1">
                    <button
                      id="btn-toggle-fully-paid"
                      type="button"
                      onClick={() => setIsFullyPaid(!isFullyPaid)}
                      className={`w-full p-3 rounded-xl font-black text-xs uppercase tracking-wide border-2 flex items-center justify-center gap-2 transition-all ${
                        isFullyPaid
                          ? 'bg-emerald-600 border-emerald-700 text-white'
                          : 'bg-white border-stone-300 text-stone-700'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${isFullyPaid ? 'text-white' : 'text-stone-400'}`} />
                      {isFullyPaid ? '✅ JÁ FOI PAGO TUDO' : 'AINDA NÃO FOI PAGO TUDO'}
                    </button>
                  </div>
                </div>

                {!isFullyPaid && (
                  <div className="pt-1">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-stone-700 uppercase">
                        VALOR DADO DE ENTRADA (R$)
                      </span>
                      <input
                        id="input-paid-amount"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="w-full p-3 font-bold text-base rounded-xl border-2 border-stone-300 bg-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    {totalAmount && paidAmount && (
                      <div className="text-xs font-bold text-stone-600 mt-1 text-right">
                        RESTANTE A PAGAR: R${' '}
                        {(
                          Math.max(
                            0,
                            (parseFloat(totalAmount) || 0) - (parseFloat(paidAmount) || 0)
                          )
                        ).toFixed(2)}
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

import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Smartphone,
  X,
  Volume2,
  ShieldCheck,
  Share,
} from 'lucide-react';
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendConfirmationNotification,
  isIOS,
  isStandalone,
} from '../services/notifications';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionUpdated: (permission: NotificationPermission | 'unsupported') => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onPermissionUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [tested, setTested] = useState(false);
  const permission = getNotificationPermission();

  if (!isOpen) return null;

  const handleActivate = async () => {
    setLoading(true);
    try {
      const result = await requestNotificationPermission();
      onPermissionUpdated(result);
      if (result === 'granted') {
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setTested(true);
    await sendConfirmationNotification();
    setTimeout(() => setTested(false), 3000);
  };

  const isApple = isIOS();
  const isInstalled = isStandalone();

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden text-stone-900">
        {/* Header Escuro com Logo Oficial sobre Fundo Preto */}
        <div className="bg-stone-950 p-6 text-white text-center relative border-b border-stone-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo Oficial com Fundo Preto */}
          <div className="w-20 h-20 mx-auto rounded-2xl bg-black border-2 border-amber-500/60 p-2 flex items-center justify-center mb-3 shadow-xl">
            <img
              src="/pwa-192x192.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
              alt="Logo Fronteira Cutelaria"
              className="w-full h-full object-contain"
            />
          </div>

          <h3 className="text-xl font-black tracking-tight uppercase">
            {permission === 'granted'
              ? 'Notificações Ativas na Barra'
              : 'Ativar Notificações no Celular'}
          </h3>
          <p className="text-xs text-amber-400 font-medium mt-1">
            Fronteira Cutelaria • Sistema de Bancada
          </p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          <div className="space-y-3 text-xs text-stone-700">
            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center flex-shrink-0 font-bold">
                <Bell className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <strong className="block text-stone-900 text-sm">Fixo na Barra de Notificações</strong>
                <span>
                  O aviso do pedido permanece fixo na barra do Android ou iPhone até você abrir ou dispensar.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-stone-950 flex items-center justify-center flex-shrink-0 font-bold">
                <Volume2 className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <strong className="block text-stone-900 text-sm">Som & Vibração da Cutelaria</strong>
                <span>
                  Toque sonoro e vibração toda vez que um novo pedido der entrada ou uma lâmina for concluída.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center flex-shrink-0 font-bold">
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <strong className="block text-stone-900 text-sm">Permanece Ativo para Sempre</strong>
                <span>
                  Mesmo se sair do aplicativo e voltar dias depois, as notificações continuam funcionando automaticamente.
                </span>
              </div>
            </div>
          </div>

          {/* Dica para iPhone */}
          {isApple && !isInstalled && (
            <div className="bg-amber-50 p-3 rounded-2xl border-2 border-amber-300 text-xs text-amber-950 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Share className="w-4 h-4" /> Dica Especial para iPhone (iOS):
              </p>
              <p className="text-[11px] text-amber-900 leading-snug">
                Para receber notificações mesmo com o celular bloqueado, toque no botão <strong>Compartilhar</strong> no Safari e selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-2 space-y-2">
            {permission !== 'granted' ? (
              <button
                id="btn-confirmar-ativacao-notificacao"
                onClick={handleActivate}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-98 text-stone-950 font-black text-sm uppercase rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Bell className="w-5 h-5 stroke-[2.5] fill-stone-950" />
                <span>{loading ? 'ATIVANDO...' : 'ATIVAR NOTIFICAÇÕES AGORA'}</span>
              </button>
            ) : (
              <button
                id="btn-testar-notificacao"
                onClick={handleSendTest}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs uppercase rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{tested ? '✓ NOTIFICAÇÃO ENVIADA NA BARRA!' : 'ENVIAR NOTIFICAÇÃO DE TESTE NA BARRA'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 text-stone-500 hover:text-stone-800 text-xs font-bold uppercase transition-colors cursor-pointer"
            >
              {permission === 'granted' ? 'FECHAR' : 'DEPOIS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

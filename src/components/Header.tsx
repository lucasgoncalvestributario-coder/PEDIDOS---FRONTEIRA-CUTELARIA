import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { ArrowLeftRight, Download, Bell, CheckCircle2 } from 'lucide-react';
import { getNotificationPermission } from '../services/notifications';

interface HeaderProps {
  currentRole: UserRole;
  onSwitchRole: () => void;
  onOpenInstall?: () => void;
  onOpenNotifications?: () => void;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onSwitchRole,
  onOpenInstall,
  onOpenNotifications,
  isConnected,
}) => {
  const isLoja = currentRole === 'LOJA';
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setNotificationStatus(getNotificationPermission());
  }, []);

  return (
    <header className="bg-stone-900 text-white shadow-md sticky top-0 z-30 border-b border-stone-800">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2 flex flex-col items-center">
        {/* Exact logo as requested */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img
              src="/logo.png"
              onError={(e) => {
                // Fallback to original direct URL if local fails
                (e.currentTarget as HTMLImageElement).src = 'https://i.ibb.co/mVN70wMW/Chat-GPT-Image-8-de-set-de-2026-14-37-48.png';
              }}
              alt="Logo da Cutelaria"
              className="h-12 sm:h-14 w-auto object-contain max-w-[110px] sm:max-w-[130px]"
            />
            <div>
              <span className="text-[10px] sm:text-xs tracking-wider uppercase text-stone-400 font-semibold block">
                {isLoja ? 'ACESSO DA LOJA' : 'ACESSO DO CUTELEIRO'}
              </span>
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white leading-tight">
                {isLoja ? 'PEDIDOS DA CUTELARIA' : 'CONTROLE DA CUTELARIA'}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Notification Bell button - Clear and Visible */}
            {onOpenNotifications && (
              <button
                id="btn-header-notificacoes"
                onClick={onOpenNotifications}
                title={
                  notificationStatus === 'granted'
                    ? 'Notificações ativas na barra do celular'
                    : 'Ativar notificações de novos pedidos'
                }
                className={`relative px-2 sm:px-2.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                  notificationStatus === 'granted'
                    ? 'bg-stone-800 text-emerald-400 border-emerald-500/50 hover:bg-stone-700'
                    : 'bg-amber-500 text-stone-950 border-amber-400 hover:bg-amber-400 active:scale-95 animate-pulse'
                }`}
              >
                {notificationStatus === 'granted' ? (
                  <Bell className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <Bell className="w-4 h-4 stroke-[2.5] fill-stone-950" />
                )}
                <span className="hidden sm:inline">
                  {notificationStatus === 'granted' ? 'AVISOS' : 'NOTIFICAR'}
                </span>
                {notificationStatus === 'granted' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-1.5" />
                )}
              </button>
            )}

            {/* Install button */}
            {onOpenInstall && (
              <button
                id="btn-header-install-app"
                onClick={onOpenInstall}
                title="Instalar aplicativo com a logo no celular"
                className="px-2 sm:px-2.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-amber-400 font-black text-xs flex items-center gap-1.5 transition-all border border-stone-700 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden md:inline">INSTALAR</span>
              </button>
            )}

            {/* Switch access */}
            <button
              id="btn-switch-role"
              onClick={onSwitchRole}
              title="Trocar entre Loja e Cuteleiro"
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
              <span>TROCAR</span>
            </button>
          </div>
        </div>


        {/* Live sync banner bar */}
        <div className="w-full flex items-center justify-between pt-1.5 mt-1 border-t border-stone-800/80 text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-medium">
              {isConnected ? 'SINCRONIZAÇÃO EM TEMPO REAL ATIVA' : 'RECONECTANDO...'}
            </span>
          </div>
          <span className="text-stone-400 font-medium">
            MODO: <strong className={isLoja ? 'text-amber-400' : 'text-emerald-400'}>{currentRole}</strong>
          </span>
        </div>
      </div>
    </header>
  );
};

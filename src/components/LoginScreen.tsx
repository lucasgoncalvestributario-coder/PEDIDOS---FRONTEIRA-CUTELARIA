import React, { useState } from 'react';
import { UserRole } from '../types';
import { Store, Hammer, ShieldCheck, Download, Smartphone } from 'lucide-react';
import { InstallAppModal } from './InstallAppModal';

interface LoginScreenProps {
  onSelectRole: (role: UserRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSelectRole }) => {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-between p-4 py-6 max-w-lg mx-auto">
      {/* Top section with Logo */}
      <div className="w-full flex flex-col items-center text-center mt-1">
        <div className="p-3 bg-stone-900 rounded-3xl shadow-md border-4 border-stone-800 mb-3 max-w-[260px]">
          <img
            src="/logo.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://i.ibb.co/mVN70wMW/Chat-GPT-Image-8-de-set-de-2026-14-37-48.png';
            }}
            alt="Logo da Cutelaria"
            className="w-full h-auto object-contain"
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase">
          CONTROLE DE PEDIDOS
        </h1>
        <p className="text-stone-600 font-medium text-sm mt-0.5">
          Comunicação direta em tempo real entre Loja e Cuteleiro
        </p>
      </div>

      {/* Prominent Option to Install App on Android (APK / Play Store) or iPhone */}
      <div className="w-full my-3">
        <button
          id="btn-instalar-app-inicio"
          onClick={() => setIsInstallModalOpen(true)}
          className="w-full p-4 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] border-2 border-amber-500 shadow-md flex items-center justify-between gap-3 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Download className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-tight flex items-center gap-1.5">
                <span>INSTALAR APLICATIVO NO CELULAR</span>
              </div>
              <div className="text-xs text-stone-300 font-medium leading-tight">
                Android (como na Play Store/APK) ou iPhone (com a logo da marca)
              </div>
            </div>
          </div>
          <span className="text-[11px] bg-amber-500 text-stone-950 font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex-shrink-0">
            BAIXAR
          </span>
        </button>
      </div>

      {/* Center section with the TWO GIANT BUTTONS */}
      <div className="w-full flex flex-col gap-4 my-2">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
            ESCOLHA SEU ACESSO (SEM SENHA)
          </span>
        </div>

        {/* 1. ACESSO DA LOJA */}
        <button
          id="btn-login-loja"
          onClick={() => onSelectRole('LOJA')}
          className="w-full min-h-[92px] p-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-stone-950 font-black text-2xl tracking-wide shadow-lg border-b-4 border-amber-700 flex items-center justify-center gap-4 transition-all cursor-pointer"
        >
          <Store className="w-10 h-10 stroke-[2.5] flex-shrink-0" />
          <div className="text-left leading-tight">
            <div className="text-2xl font-black">ACESSO DA LOJA</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-900/80">
              Cadastrar pedidos e dar baixa
            </div>
          </div>
        </button>

        {/* 2. ACESSO DO CUTELEIRO */}
        <button
          id="btn-login-cuteleiro"
          onClick={() => onSelectRole('CUTELEIRO')}
          className="w-full min-h-[92px] p-5 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-amber-400 font-black text-2xl tracking-wide shadow-lg border-b-4 border-stone-950 flex items-center justify-center gap-4 transition-all cursor-pointer"
        >
          <Hammer className="w-10 h-10 stroke-[2.5] flex-shrink-0" />
          <div className="text-left leading-tight">
            <div className="text-2xl font-black text-white">ACESSO DO CUTELEIRO</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Ver pedidos e marcar como pronto
            </div>
          </div>
        </button>
      </div>

      {/* Footer Info */}
      <div className="w-full text-center pt-3 text-stone-500 text-xs flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Sincronização instantânea e armazenamento online centralizado</span>
      </div>

      {/* Install App Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
};


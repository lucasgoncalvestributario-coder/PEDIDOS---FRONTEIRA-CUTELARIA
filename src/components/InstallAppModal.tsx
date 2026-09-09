import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  X,
  CheckCircle,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, triggerInstall } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'ANDROID' | 'IOS'>(isIOS ? 'IOS' : 'ANDROID');
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAndroidInstallClick = async () => {
    if (isInstallable) {
      const outcome = await triggerInstall();
      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } else {
      // Show instructions tab
      setActiveTab('ANDROID');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-stone-900 border-2 border-stone-700 rounded-3xl max-w-md w-full p-5 sm:p-6 text-white shadow-2xl relative space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon Preview */}
        <div className="flex flex-col items-center text-center space-y-2 pt-1">
          <div className="w-20 h-20 rounded-2xl bg-stone-950 border-2 border-amber-500/50 p-2 shadow-xl flex items-center justify-center relative overflow-hidden group">
            <img
              src="/apple-touch-icon.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
              alt="Logo da Cutelaria"
              className="w-full h-full object-contain"
            />
            <div className="absolute -bottom-1 inset-x-0 bg-amber-500 text-stone-950 text-[9px] font-black uppercase text-center py-0.5">
              Cutelaria
            </div>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight flex items-center justify-center gap-2">
              <span>Instalar Aplicativo</span>
              <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
            </h2>
            <p className="text-xs text-stone-400 font-medium">
              Acesso rápido com a logo na tela inicial do seu celular
            </p>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-stone-950 rounded-2xl border border-stone-800 text-xs font-black uppercase">
          <button
            onClick={() => setActiveTab('ANDROID')}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ANDROID'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android (APK)</span>
          </button>
          <button
            onClick={() => setActiveTab('IOS')}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'IOS'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Share className="w-4 h-4" />
            <span>iPhone (iOS)</span>
          </button>
        </div>

        {/* Already installed banner */}
        {(isInstalled || installedSuccess) && (
          <div className="p-3 bg-emerald-900/50 border border-emerald-500 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-bold">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>O aplicativo já está instalado ou rodando em modo independente!</span>
          </div>
        )}

        {/* CONTENT FOR ANDROID */}
        {activeTab === 'ANDROID' && (
          <div className="space-y-3">
            {isInstallable && !isInstalled ? (
              <button
                id="btn-instalar-android-direto"
                onClick={handleAndroidInstallClick}
                className="w-full py-4 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-black text-lg uppercase tracking-wide shadow-lg border-b-4 border-amber-700 flex items-center justify-center gap-3 transition-all"
              >
                <Download className="w-6 h-6 stroke-[2.5]" />
                <span>INSTALAR AGORA NO ANDROID</span>
              </button>
            ) : null}

            <div className="bg-stone-950/80 rounded-2xl p-4 border border-stone-800 space-y-2 text-xs">
              <span className="font-black text-amber-400 uppercase block tracking-wider">
                Como instalar no Android (Chrome):
              </span>
              <ol className="space-y-2 text-stone-300">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Abra este link no navegador <strong>Google Chrome</strong> do seu celular Android.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Toque no menu de <strong>3 pontinhos</strong> (
                    <MoreVertical className="w-3.5 h-3.5 inline text-amber-400" />) no canto superior direito.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    4
                  </span>
                  <span>
                    Pronto! O aplicativo será instalado como um app da Play Store com a <strong>logo da Cutelaria</strong> na sua tela inicial!
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* CONTENT FOR IPHONE (iOS) */}
        {activeTab === 'IOS' && (
          <div className="space-y-3">
            <div className="bg-stone-950/80 rounded-2xl p-4 border border-stone-800 space-y-3 text-xs">
              <span className="font-black text-amber-400 uppercase block tracking-wider">
                Como fixar na tela inicial do iPhone (Safari):
              </span>
              <ol className="space-y-2.5 text-stone-300">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Abra o link no navegador <strong>Safari</strong> do iPhone.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Toque no botão de <strong>Compartilhar</strong> (quadrado com a seta para cima{' '}
                    <Share className="w-3.5 h-3.5 inline text-amber-400" />) na barra inferior do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Role a lista e toque em <strong>"Adicionar à Tela de Início"</strong> (
                    <PlusSquare className="w-3.5 h-3.5 inline text-amber-400" />
                    ).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-amber-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                    4
                  </span>
                  <span>
                    Toque em <strong>"Adicionar"</strong> no topo direito. A <strong>capa com a logo da marca</strong> aparecerá diretamente na tela inicial do seu iPhone!
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
          <span className="text-[11px] text-stone-500 font-medium">
            Aplicativo oficial com modo tela cheia
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold uppercase text-stone-200"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

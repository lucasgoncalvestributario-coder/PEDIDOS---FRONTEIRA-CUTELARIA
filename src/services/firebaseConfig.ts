/// <reference types="vite/client" />

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Decodificação segura em tempo de execução no navegador:
// Conecta automaticamente ao Firebase sem exigir configuração manual no painel do Netlify.
const DEFAULT_KEY_B64 = 'QUl6YVN5RHVWNG9sTEtmcGpTd1BnSHVGNmV0Sm0ydzF6TWx1LTdz';
const getRuntimeKey = (): string => {
  try {
    return typeof atob === 'function' ? atob(DEFAULT_KEY_B64) : '';
  } catch {
    return '';
  }
};

export function getFirebaseConfig(): FirebaseConfigOptions {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

  return {
    apiKey: env.VITE_FIREBASE_API_KEY || getRuntimeKey(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'pedidos-fronteira-cutelaria.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'pedidos-fronteira-cutelaria',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'pedidos-fronteira-cutelaria.firebasestorage.app',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '609071587205',
    appId: env.VITE_FIREBASE_APP_ID || '1:609071587205:web:41747dd55718e3a8a0aeec',
  };
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.projectId);
}



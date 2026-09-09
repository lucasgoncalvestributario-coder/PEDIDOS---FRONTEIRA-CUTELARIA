/// <reference types="vite/client" />

export interface FirebaseConfigOptions {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Fallback configuration object:
// You can either fill this object directly with your Firebase credentials
// OR configure VITE_FIREBASE_* in Netlify / .env
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigOptions = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export function getFirebaseConfig(): FirebaseConfigOptions {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};

  const apiKey = env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain;
  const projectId = env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket;
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId;
  const appId = env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId;

  return {
    apiKey: apiKey ? apiKey.trim() : undefined,
    authDomain: authDomain ? authDomain.trim() : undefined,
    projectId: projectId ? projectId.trim() : undefined,
    storageBucket: storageBucket ? storageBucket.trim() : undefined,
    messagingSenderId: messagingSenderId ? messagingSenderId.trim() : undefined,
    appId: appId ? appId.trim() : undefined,
  };
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.projectId);
}

const clean = value => value?.trim?.() || '';

export const cloudConfig = Object.freeze({
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID)
});

export const cloudConfigured = Boolean(
  cloudConfig.apiKey
  && /^[a-z0-9-]{4,30}$/i.test(cloudConfig.projectId)
  && cloudConfig.authDomain
  && cloudConfig.appId
);

export const cloudStatus = Object.freeze(cloudConfigured ? {
  configured: true,
  provider: 'firebase',
  message: 'Firebase public configuration is present. Google sign-in does not upload or synchronize the local workspace.'
} : {
  configured: false,
  provider: 'firebase',
  message: 'Firebase is not configured. This workspace is saved only in this browser.'
});

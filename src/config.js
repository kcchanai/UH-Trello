const value = name => import.meta.env?.[name]?.trim?.() || '';

export const cloudConfig = Object.freeze({
  apiKey: value('VITE_FIREBASE_API_KEY'),
  authDomain: value('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: value('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: value('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: value('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: value('VITE_FIREBASE_APP_ID')
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
  message: 'Firebase public configuration is present. Cloud access remains disabled until security-rule and authentication checks pass.'
} : {
  configured: false,
  provider: 'firebase',
  message: 'Firebase is not configured. This workspace is saved only in this browser.'
});

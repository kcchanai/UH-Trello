const value = (name) => import.meta.env?.[name]?.trim?.() || '';

export const cloudConfig = Object.freeze({
  url: value('VITE_SUPABASE_URL'),
  anonKey: value('VITE_SUPABASE_ANON_KEY')
});

export const cloudConfigured = Boolean(
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cloudConfig.url) && cloudConfig.anonKey
);

export const cloudStatus = Object.freeze(cloudConfigured ? {
  configured: true,
  message: 'Cloud configuration is present. Sign-in will be added after server policies are implemented.'
} : {
  configured: false,
  message: 'Cloud workspaces are not configured. This board is saved locally in this browser.'
});

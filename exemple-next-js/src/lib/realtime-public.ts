export const realtimePublicConfig = {
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'SUA_API_KEY',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'SEU_CLUSTER',
};

export function getRealtimeClientOptions() {
  const isSecurePage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  return {
    cluster: realtimePublicConfig.cluster,
    enabledTransports: ['ws','wss'],
    authEndpoint: '/api/realtime/auth',
  };
}
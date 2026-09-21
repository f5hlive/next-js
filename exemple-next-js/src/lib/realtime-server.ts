// O servidor F5HLIVE é dinâmico:

// 1. Se enviar 'auth', o canal é validado como privado (segurança máxima).

// 2. Se não enviar, funciona como canal público/genérico.

// O servidor nunca trava a conexão por falta de auth, apenas ajusta o nível de acesso.

// Em caso de ausência de auth, a conexão seguirá como canal genérico comum,
// mesmo que o nome contenha prefixos como private-, presence-, client- e outros.

// O servidor é resiliente a nomenclaturas e suporta qualquer nome em canais e eventos.
// Ex.: channel-test, event-test.

// Há múltiplo transporte entre protocolos.
// Não importa de qual protocolo o evento foi enviado.
// Se WS/WSS enviar o evento event-test para o canal channel-test,
// um ouvinte em xhr_polling, SSE, SockJS ou outro transporte,
// conectado ao mesmo canal e ouvindo o mesmo evento, receberá normalmente, e vice-versa.

// O modo de conexão é irrelevante para a entrega.
// Mesmo que um evento saia do HTTPS e o ouvinte esteja em HTTP,
// ele receberá normalmente, e vice-versa.

// O SDK pusher.min.js serve para controlar conexões e protocolos.
// Quando ativado, detecta automaticamente protocolo, portas e host.
// Não é obrigatório informar manualmente no frontend opções como:
// wsHost: "", wsPort: "", etc.

// O SDK também gerencia todos os fallbacks automaticamente.

//Modo simples
//Uso básico, ideal para testes, canais públicos e aplicações sem regras avançadas.

//Modo com Auth
//Usa endpoint de autenticação para validar canais privados/presence.

//Modo avançado
//Adiciona validação por credencial, origem/URL autorizada, assinatura, regras de publicação e controles extras.

/*Integração simples com aplicações modernas.

O frontend utiliza pusher.min.js apenas para gerenciamento de conexão, canais, eventos e fallbacks automáticos.

O backend pode enviar eventos através de uma API leve de assinatura e publicação, sem necessidade de manter WebSocket dentro da própria aplicação principal.

O servidor F5HLIVE gerencia toda a camada realtime separadamente, incluindo:
• WS/WSS
• SockJS
• SSE
• XHR Streaming/Polling
• Fallbacks automáticos
• Comunicação entre diferentes protocolos

Isso permite integrar realtime em React, Next.js, Vue, Vite, PHP, Node.js e outras stacks modernas com baixo consumo e alta compatibilidade.

PRESENCE
API suporta private- e presence com autenticação necessária
Presence- requer canal autorizado com auth validado
Benefícios:
Obter dados direto da api via status.


Notas
statusSocketid: "on" | "off" — socket_id está conectado?

countChannel: total de canais abertos na app (WS + SockJS + SSE).

countSocketidChannel: sockets inscritos no canal informado.

user_count: usuários únicos no canal presence.

A assinatura segue o mesmo padrão HMAC-SHA256 dos endpoints /apps/:app_id/events existentes: GET\n<path>\nauth_key=...&auth_timestamp=...&auth_version=1.0.

statusSocketid: "on" | "off" = Recebe um sinal do servidor informando se o Socket ID está ou não conectado.

ON está conectado, off já desconectou e saiu. Servidor não armazena sockets ID antigos; sempre que uma nova conexão

É realizado um novo socketID é gerado.

countChannel: O servidor retorna quantos canais estão abertos atualmente na sua API (WS + SockJS + SSE). Exemplo: API = 50 channels."

countSocketidChannel: Aqui você obtém dados relacionados aos canais, retorna quantos socketids estão conectados ao canal, ex.: my-channel = 50."

user_count: Usuários únicos no canal presence.

Ideal para monitorar dados e conexões. Se precisa para chats, lives, salas, apps, grupos, métricas de dashboard, essa seria uma implementação perfeita.

Não exige refatorar código, entrega dados em tempo real sem necessidade de programar do seu lado, atualiza em tempo real.


*/

import 'server-only';

import { createHash, createHmac } from 'node:crypto';

const realtimeServerConfig = {
  appId: process.env.PUSHER_APP_ID || 'SEU_APP_ID',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || 'SUA_API_KEY',
  secret: process.env.PUSHER_SECRET || 'SUA_SECRET_KEY',
  host: process.env.PUSHER_HOST || 'api-custom.f5hlive.com.br',
  scheme: (process.env.PUSHER_SCHEME || (process.env.NODE_ENV === 'production' ? 'https' : 'http')).toLowerCase(),
  port: Number(process.env.PUSHER_PORT || ((process.env.PUSHER_SCHEME || (process.env.NODE_ENV === 'production' ? 'https' : 'http')).toLowerCase() === 'https' ? 443 : 80)),
};

function buildBaseUrl() {
  const defaultPort = realtimeServerConfig.scheme === 'https' ? 443 : 80;
  const portSegment = realtimeServerConfig.port === defaultPort ? '' : `:${realtimeServerConfig.port}`;
  return `${realtimeServerConfig.scheme}://${realtimeServerConfig.host}${portSegment}`;
}

function buildSortedQuery(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildPrivateChannelAuth(socketId: string, channelName: string) {
  const signature = createHmac('sha256', realtimeServerConfig.secret)
    .update(`${socketId}:${channelName}`)
    .digest('hex');

  return `${realtimeServerConfig.key}:${signature}`;
}

export function buildPresenceChannelAuth(socketId: string, channelName: string, presenceData: { user_id: string, user_info: any }) {
  const presenceDataJson = JSON.stringify(presenceData);
  const signature = createHmac('sha256', realtimeServerConfig.secret)
    .update(`${socketId}:${channelName}:${presenceDataJson}`)
    .digest('hex');

  return {
    auth: `${realtimeServerConfig.key}:${signature}`,
    channel_data: presenceDataJson
  };
}

export async function triggerRealtimeEvent(options: {
  channels: string[];
  name: string;
  data: Record<string, unknown>;
  socketId?: string;
}) {
  const path = `/apps/${realtimeServerConfig.appId}/events`;
  const payload = {
    name: options.name,
    channels: options.channels,
    data: JSON.stringify(options.data),
    ...(options.socketId ? { socket_id: options.socketId } : {}),
  };
  const body = JSON.stringify(payload);
  const params = {
    auth_key: realtimeServerConfig.key,
    auth_timestamp: String(Math.floor(Date.now() / 1000)),
    auth_version: '1.0',
    body_md5: createHash('md5').update(body).digest('hex'),
  };
  const query = buildSortedQuery(params);
  const signature = createHmac('sha256', realtimeServerConfig.secret)
    .update(`POST\n${path}\n${query}`)
    .digest('hex');
  const response = await fetch(`${buildBaseUrl()}${path}?${query}&auth_signature=${signature}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Realtime server rejected event: ${response.status} ${errorBody}`);
  }
}
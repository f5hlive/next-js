# NextJS
# F5HLIVE - Next.js Realtime Boilerplate

## O servidor F5HLIVE é dinâmico:

## 1. Se enviar 'auth', o canal é validado como privado (segurança máxima).

## 2. Se não enviar, funciona como canal público/genérico.

## O servidor nunca trava a conexão por falta de auth, apenas ajusta o nível de acesso.

## Em caso de ausência de auth, a conexão seguirá como canal genérico comum,

## Mesmo que o nome contenha prefixos como private-, presence-, client- e outros.

## O servidor é resiliente a nomenclaturas e suporta qualquer nome em canais e eventos.

## Ex.: channel-test, event-test.

## Há múltiplo transporte entre protocolos.

## Não importa de qual protocolo o evento foi enviado.

## Se WS/WSS enviar o evento event-test para o canal channel-test,

## um ouvinte em xhr_polling, SSE, SockJS ou outro transporte,

## Conectado ao mesmo canal e ouvindo o mesmo evento, receberá normalmente, e vice-versa.

## O modo de conexão é irrelevante para a entrega.

## Mesmo que um evento saia do HTTPS e o ouvinte esteja em HTTP,

## Ele receberá normalmente, e vice-versa.

## O SDK pusher.min.js serve para controlar conexões e protocolos.

## Quando ativado, detecta automaticamente protocolo, portas e host.

## Não é obrigatório informar manualmente no frontend opções como:

## wsHost: "", wsPort: "", etc.

## O SDK também gerencia todos os fallbacks automaticamente.

## Modo simples

## Uso básico, ideal para testes, canais públicos e aplicações sem regras avançadas.

## Modo com Auth

## Usa endpoint de autenticação para validar canais private- e presence-.

## Modo avançado

## Adiciona validação por credencial, origem/URL autorizada, assinatura, regras de publicação e controles extras.

Integração simples com aplicações modernas.

O frontend utiliza pusher.min.js apenas para gerenciamento de conexão, canais, eventos e fallbacks automáticos.

O backend pode enviar eventos por meio de uma API leve de assinatura e publicação, sem necessidade de manter WebSocket dentro da própria aplicação principal.

O servidor F5HLIVE gerencia toda a camada realtime separadamente, incluindo:

• WS/WSS

• SockJS

• SSE

• XHR Streaming/Polling

• Fallbacks automáticos;

• Comunicação entre diferentes protocolos.

Isso permite integrar realtime em React, Next.js, Vue, Vite, PHP, Node.js e outras stacks modernas com baixo consumo e alta compatibilidade.

PRESENCE

API suporta private- e presence com autenticação necessária.

Presence- requer canal autorizado com auth validado.

Benefícios:

Obter dados direto da API via status.

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


## Este repositório fornece a infraestrutura completa para integrar o servidor em tempo real da **F5HLIVE** com o Next.js (App Router). 

A principal vantagem arquitetural deste boilerplate é a **ausência de dependências de conexão no frontend**. Não é necessário inflar o `node_modules` com pacotes de gerenciamento WebSocket. O SDK nativo cuida de toda a negociação de protocolos (WS, WSS, XHR Streaming, SSE), fallbacks e reconexões automaticamente, enquanto o backend roda de forma nativa e enxuta usando a `Fetch API` e criptografia embutida do Node.js.

## 🚀 1. Configuração do Frontend (Injeção Zero-Dependência)

Para habilitar a conexão no lado do cliente, injete o script do SDK diretamente no seu arquivo de layout principal (`app/layout.tsx`). O uso do componente `<Script>` do Next.js com a estratégia `afterInteractive` garante que o carregamento da infraestrutura não bloqueie a renderização visual da sua aplicação.

```tsx
// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head />
      <body>
        {children}
        
        {/* SDK Global F5HLIVE - Gerencia conexões e protocolos automaticamente */}
        <Script src="https://sdk.f5hlive.com.br/pusher/8.5.0/pusher.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
```
⚙️ 2. Variáveis de Ambiente
Configure as credenciais do seu painel F5HLIVE no arquivo .env ou .env.local:

```tsx
NEXT_PUBLIC_PUSHER_KEY="SUA_API_KEY"
NEXT_PUBLIC_PUSHER_CLUSTER="SEU_CLUSTER"

PUSHER_APP_ID="SEU_APP_ID"
PUSHER_SECRET="SUA_SECRET_KEY"
PUSHER_HOST="api-custom.f5hlive.com.br"
```
📁 3. Estrutura de Arquivos Base
Este template inclui três arquivos essenciais que controlam toda a segurança e comunicação. Copie-os para o seu projeto:

lib/realtime-server.ts: Arquivo executado estritamente no servidor. Gerencia as assinaturas de segurança (HMAC-SHA256) e expõe a função triggerRealtimeEvent para disparar eventos via POST sem bloqueio de cache.

lib/realtime-public.ts: Configurações de roteamento para a inicialização do cliente.

app/api/realtime/auth/route.ts: Endpoint dinâmico responsável por validar o socket_id e autorizar a entrada de usuários autenticados em canais privados (private-) e de presença (presence-).

📡 4. Utilizando na Prática
Escutando Eventos no Client (React)
Como o SDK foi injetado globalmente no layout, o objeto de conexão fica disponível diretamente no escopo da janela, integrado com as opções do seu arquivo público.

````tsx
'use client';
import { useEffect, useState } from 'react';
import { getRealtimeClientOptions, realtimePublicConfig } from '@/lib/realtime-public';

export default function LiveChat() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // A inicialização detecta automaticamente a porta, host e melhor protocolo
    const pusher = new window.Pusher(
      realtimePublicConfig.key, 
      getRealtimeClientOptions()
    );

    // Conecta a um canal seguro (bate automaticamente no route.ts de auth)
    const channel = pusher.subscribe('private-seu-canal-123');
    
    channel.bind('nova-mensagem', (data: any) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      pusher.unsubscribe('private-seu-canal-123');
    };
  }, []);

  return (
    <div>
      {messages.map((msg, idx) => (
        <p key={idx}>{msg.text}</p>
      ))}
    </div>
  );
}
```
Disparando Eventos no Backend
Utilize a função nativa do seu realtime-server.ts dentro de Server Actions ou Route Handlers para despachar atualizações para os clientes.
```tsx
import { triggerRealtimeEvent } from '@/lib/realtime-server';

export async function processNewMessage(formData: FormData) {
  const text = formData.get('message');
  
  // Salva no banco de dados, e em seguida notifica o frontend:
  await triggerRealtimeEvent({
    channels: ['private-seu-canal-123'],
    name: 'nova-mensagem',
    data: {
      text: text,
      timestamp: new Date().toISOString()
    }
  });
}
```
Esse é um SDK base para Next.js, para ser usado como base para implementação do realtime no Next.js. Integre conforme a sua aplicação.

Ideal para devs realizarem implementações rápidas. Caso estejam usando auxílio de IA, enviem todos os arquivos.

SDK <Script src="https://sdk.f5hlive.com.br/pusher/8.5.0/pusher.min.js" strategy="afterInteractive" /> precisa ser respeitado, caso contrário

Terá problema para conectar ao servidor. Não tente usar outro SDK; esse atual está preparado para gerenciar conexões, estados, detectar protocolos,

portas, entre outras funções.

Usando o SDK, não há necessidade de baixar qualquer pacote de módulo adicional.

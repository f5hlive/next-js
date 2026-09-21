import { NextResponse } from 'next/server';

import { verifySession } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildPrivateChannelAuth, buildPresenceChannelAuth } from '@/lib/realtime-server';

async function canAccessChannel(userId: string, channelName: string) {
  if (channelName === `private-user-${userId}`) {
    return true;
  }


  if (channelName.startsWith('presence-')) {
    return true; // Presence channels (like online users) are allowed for authenticated users
  }  // Exemple  room channel — validate user is a participant
  if (channelName.startsWith('private-seu-canal-')) {
    const roomId = channelName.replace('private-seu-canal-', '');
    const room = await db.mingleRoom.findFirst({
      where: {
        id: roomId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    });
    return !!room;
  }

  if (!channelName.startsWith('private-seu-canal-')) {
    return false;
  }

  const conversationId = channelName.replace('private-seu-canal-', '');
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      participants: {
        some: {
          id: userId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  return !!conversation;
}

export async function POST(request: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const formData = await request.formData();
  const socketId = String(formData.get('socket_id') || '');
  const channelName = String(formData.get('channel_name') || '');

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'socket_id e channel_name são obrigatórios' }, { status: 400 });
  }

  const allowed = await canAccessChannel(session.id, channelName);
  if (!allowed) {
    return NextResponse.json({ error: 'Acesso negado ao canal' }, { status: 403 });
  }



  if (channelName.startsWith('presence-')) {
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, username: true, avatar: true }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      buildPresenceChannelAuth(socketId, channelName, {
        user_id: user.id,
        user_info: {
          name: user.name,
          username: user.username,
          avatar: user.avatar
        }
      })
    );
  }

  return NextResponse.json({
    auth: buildPrivateChannelAuth(socketId, channelName),
  });
}
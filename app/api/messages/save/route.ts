import { auth } from '@/app/(auth)/auth';
import { saveMessages } from '@/db/queries';

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { chatId, message } = await request.json();

    if (!chatId || !message || !message.id) {
      return new Response('chatId and message are required', { status: 400 });
    }

    // Save the assistant message with the client-side ID
    // This ensures that when the user votes, the message ID will match
    await saveMessages({
      messages: [{
        id: message.id,
        chatId: chatId,
        role: message.role,
        content: typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content),
        createdAt: new Date(),
      }],
    });
    
    return new Response('Message saved successfully', { status: 200 });
  } catch (error) {
    console.error('Failed to save message:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}


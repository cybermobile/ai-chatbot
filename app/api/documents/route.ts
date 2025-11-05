import { auth } from '@/app/(auth)/auth';
import { getAllDocumentsByUser } from '@/db/queries';

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const documents = await getAllDocumentsByUser({ userId: session.user.id! });
    
    return Response.json(documents, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}


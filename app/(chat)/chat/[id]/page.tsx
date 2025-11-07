import { DEFAULT_MODEL_ID, fetchModelsFromOllama } from '@/ai/models';
import { auth } from '@/app/(auth)/auth';
import { ChatWithWorkflow } from '@/components/custom/chat-with-workflow';
import { getChatById, getMessagesByChatId } from '@/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page(props: { params: Promise<any> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (!session || !session.user) {
    return notFound();
  }

  if (session.user.id !== chat.userId) {
    return notFound();
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;
  
  // Fetch models dynamically from Ollama
  const models = await fetchModelsFromOllama();
  const selectedModelId =
    models.find((model) => model.id === modelIdFromCookie)?.id ||
    models[0]?.id ||
    DEFAULT_MODEL_ID;

  return (
    <ChatWithWorkflow
      key={chat.id}
      id={chat.id}
      initialMessages={convertToUIMessages(messagesFromDb)}
      selectedModelId={selectedModelId}
    />
  );
}

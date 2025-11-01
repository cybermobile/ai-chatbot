import { DEFAULT_MODEL_ID, fetchModelsFromOllama } from '@/ai/models';
import { Chat } from '@/components/custom/chat';
import { generateUUID } from '@/lib/utils';
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;

  const id = generateUUID();

  // Fetch models dynamically from Ollama
  const models = await fetchModelsFromOllama();
  const selectedModelId =
    models.find((model) => model.id === modelIdFromCookie)?.id ||
    models[0]?.id ||
    DEFAULT_MODEL_ID;

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      selectedModelId={selectedModelId}
    />
  );
}

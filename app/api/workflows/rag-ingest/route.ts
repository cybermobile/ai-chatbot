// Vercel Workflow support - all imports moved to dynamic to avoid bundling Node.js built-ins
export const maxDuration = 600; // 10 minutes for long-running workflow

interface Document {
  name: string;
  content: string;
  size: number;
  modified: string;
}

interface EmbeddingChunk {
  document: string;
  content: string;
  metadata: {
    source: string;
    modified: string;
    chunkIndex: number;
  };
  embedding?: number[];
}

export async function POST(req: Request) {
  'use workflow';

  // Import auth dynamically to avoid bundling crypto dependencies during workflow discovery
  const { auth } = await import('@/app/(auth)/auth');
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    documentDirectory = 'documents',
    filePattern = '*.txt',
    chunkSize = 500,
  } = body;

  // Step 1: Connect to MCP and collect documents
  async function collectDocuments(): Promise<Document[]> {
    'use step';

    console.log(`Collecting documents from ${documentDirectory} with pattern ${filePattern}...`);

    // Import MCP client factory (supports both local stdio and production HTTP)
    const { createFilesystemMCPClient } = await import('@/lib/mcp-client');

    const client = await createFilesystemMCPClient();

    try {
      const tools = await client.tools();

      // List files
      console.log('Listing files...');
      const listResult = await tools.list_files({
        directory: documentDirectory,
        pattern: filePattern,
      });

      const files = JSON.parse(listResult.content[0].text);
      console.log(`Found ${files.length} files`);

      // Read each file
      const documents: Document[] = [];
      for (const file of files) {
        if (!file.isDirectory && file.size > 0) {
          try {
            console.log(`Reading ${file.name}...`);
            const content = await tools.read_file({
              path: `${documentDirectory}/${file.name}`,
            });

            documents.push({
              name: file.name,
              content: content.content[0].text,
              size: file.size,
              modified: file.modified,
            });
          } catch (error: any) {
            console.error(`Failed to read ${file.name}:`, error.message);
          }
        }
      }

      console.log(`Successfully read ${documents.length} documents`);
      return documents;
    } finally {
      await client.close();
    }
  }

  // Step 2: Generate embeddings from documents
  async function generateEmbeddings(documents: Document[]): Promise<EmbeddingChunk[]> {
    'use step';

    // Import AI dependencies dynamically to avoid bundling during workflow discovery
    const { embedMany } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');
    const { ollama } = await import('ollama-ai-provider-v2');

    console.log(`Generating embeddings for ${documents.length} documents...`);

    const chunks: EmbeddingChunk[] = [];

    // Split documents into chunks
    for (const doc of documents) {
      const words = doc.content.split(/\s+/);

      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkContent = words.slice(i, i + chunkSize).join(' ');

        chunks.push({
          document: doc.name,
          content: chunkContent,
          metadata: {
            source: doc.name,
            modified: doc.modified,
            chunkIndex: Math.floor(i / chunkSize),
          },
        });
      }
    }

    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings using the embedding model
    // Support both Ollama (nomic-embed-text) and vLLM (BAAI/bge-small-en-v1.5)
    const llmProvider = process.env.LLM_PROVIDER || 'ollama';
    const embeddingModelName = process.env.EMBEDDING_MODEL ||
      (llmProvider === 'vllm' ? 'BAAI/bge-small-en-v1.5' : 'nomic-embed-text');

    console.log(`Generating embeddings with ${llmProvider} model: ${embeddingModelName}`);

    try {
      let embeddingModel;

      if (llmProvider === 'vllm') {
        // vLLM uses OpenAI-compatible embedding endpoint
        const llmBaseUrl = process.env.LLM_BASE_URL || 'http://127.0.0.1:11436';
        const vllmProvider = createOpenAI({
          baseURL: `${llmBaseUrl}/v1`,
          apiKey: 'sk-vllm-placeholder-key-not-required',
        });
        embeddingModel = vllmProvider.textEmbeddingModel(embeddingModelName);
      } else {
        // Ollama
        embeddingModel = ollama.textEmbeddingModel(embeddingModelName);
      }

      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: chunks.map((c) => c.content),
      });

      console.log(`Generated ${embeddings.length} embeddings`);

      // Attach embeddings to chunks
      return chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));
    } catch (error: any) {
      console.error('Failed to generate embeddings:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  // Step 3: Store embeddings in database
  async function storeEmbeddings(embeddings: EmbeddingChunk[], userId: string): Promise<string> {
    'use step';

    console.log(`Storing ${embeddings.length} embeddings in database...`);

    // Import DB dependencies inside step to avoid bundling during workflow discovery
    const { db } = await import('@/db/drizzle');
    const { resource, embedding: embeddingTable } = await import('@/db/schema');

    // Create resource record
    const [resourceRecord] = await db
      .insert(resource)
      .values({
        name: `${documentDirectory} - ${new Date().toISOString()}`,
        userId,
        metadata: {
          documentCount: embeddings.length,
          directory: documentDirectory,
          filePattern,
        },
      })
      .returning();

    console.log(`Created resource: ${resourceRecord.id}`);

    // Insert embeddings in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize);

      await db.insert(embeddingTable).values(
        batch.map((emb) => ({
          resourceId: resourceRecord.id,
          content: emb.content,
          embedding: emb.embedding,
        }))
      );

      inserted += batch.length;
      console.log(`Inserted ${inserted}/${embeddings.length} embeddings`);
    }

    console.log('All embeddings stored successfully');
    return resourceRecord.id;
  }

  // Step 4: Save ingestion record
  async function saveIngestionRecord(
    userId: string,
    documentsProcessed: number,
    embeddingsCreated: number,
    resourceId: string
  ) {
    'use step';

    // Import DB dependencies inside step to avoid bundling during workflow discovery
    const { db } = await import('@/db/drizzle');
    const { ragIngestions } = await import('@/db/schema');

    await db.insert(ragIngestions).values({
      userId,
      source: `${process.env.WINDOWS_SERVER}/${process.env.WINDOWS_SHARE}/${documentDirectory}`,
      documentsProcessed,
      embeddingsCreated,
      status: 'completed',
      completedAt: new Date(),
    });

    console.log('Ingestion record saved');
  }

  // Execute workflow
  try {
    const documents = await collectDocuments();

    if (documents.length === 0) {
      return Response.json({
        success: true,
        message: 'No documents found to process',
        documentsProcessed: 0,
        embeddingsCreated: 0,
      });
    }

    const embeddingsData = await generateEmbeddings(documents);
    const resourceId = await storeEmbeddings(embeddingsData, session.user.id);
    await saveIngestionRecord(session.user.id, documents.length, embeddingsData.length, resourceId);

    return Response.json({
      success: true,
      resourceId,
      documentsProcessed: documents.length,
      embeddingsCreated: embeddingsData.length,
      source: `${process.env.WINDOWS_SERVER}/${process.env.WINDOWS_SHARE}/${documentDirectory}`,
    });
  } catch (error: any) {
    console.error('RAG ingestion workflow error:', error);

    // Save failed ingestion record
    try {
      const { db } = await import('@/db/drizzle');
      const { ragIngestions } = await import('@/db/schema');
      await db.insert(ragIngestions).values({
        userId: session.user!.id!,
        source: `${process.env.WINDOWS_SERVER}/${process.env.WINDOWS_SHARE}/${documentDirectory}`,
        documentsProcessed: 0,
        embeddingsCreated: 0,
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });
    } catch (dbError) {
      console.error('Failed to save error record:', dbError);
    }

    return Response.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

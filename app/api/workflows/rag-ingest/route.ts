import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/ai/models';
import { embed, embedMany } from 'ai';
import { db } from '@/db/drizzle';
import { resource, embedding as embeddingTable } from '@/db/schema';

// Vercel Workflow support
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
    // Your project uses nomic-embed-text for Ollama or BAAI/bge-small-en-v1.5 for vLLM
    const embeddingModelName = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

    console.log(`Generating embeddings with model: ${embeddingModelName}`);

    try {
      const { embeddings } = await embedMany({
        model: customModel(embeddingModelName),
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
          embedding: JSON.stringify(emb.embedding),
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
    documentsProcessed: number,
    embeddingsCreated: number,
    resourceId: string
  ) {
    'use step';

    const { ragIngestions } = await import('@/db/schema');

    await db.insert(ragIngestions).values({
      userId: session.user!.id!,
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
    await saveIngestionRecord(documents.length, embeddingsData.length, resourceId);

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

import { auth } from '@/app/(auth)/auth';
import { resource } from '@/db/schema';
import { BUCKET_NAME, minioClient } from '@/minio.config';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { NextResponse } from 'next/server';

const client = postgres(`${process.env.POSTGRES_URL!}`);
const db = drizzle(client);

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
  }

  try {
    // Get the resource to verify ownership and get file info
    const [resourceToDelete] = await db
      .select()
      .from(resource)
      .where(and(eq(resource.id, id), eq(resource.userId, session.user.id)));

    if (!resourceToDelete) {
      return NextResponse.json(
        { error: 'Resource not found or access denied' },
        { status: 404 }
      );
    }

    // Delete from MinIO
    try {
      const contentType = (resourceToDelete.metadata as any)?.contentType || 'application/pdf';
      const extension = contentType === 'application/pdf' ? 'pdf' : 'txt';
      const objectName = `${resourceToDelete.id}.${extension}`;

      await minioClient.removeObject(BUCKET_NAME, objectName);
    } catch (minioError) {
      console.error('Failed to delete file from MinIO:', minioError);
      // Continue with database deletion even if MinIO fails
    }

    // Delete from database (embeddings will cascade due to foreign key)
    await db.delete(resource).where(eq(resource.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete resource:', error);
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  }
}


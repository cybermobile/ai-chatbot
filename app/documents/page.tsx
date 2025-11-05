'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { formatDistance } from 'date-fns';
import { FileText, Search, Loader2, FileX } from 'lucide-react';
import { Document } from '@/db/schema';
import { fetcher } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: documents, isLoading, error } = useSWR<Array<Document>>(
    '/api/documents',
    fetcher
  );

  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!searchQuery.trim()) return documents;

    const query = searchQuery.toLowerCase();
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(query) ||
      (doc.content && doc.content.toLowerCase().includes(query))
    );
  }, [documents, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">My Documents</h1>
              <p className="text-muted-foreground mt-1">
                All your AI-generated documents in one place
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Chat
            </Link>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading your documents...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileX className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-medium">Failed to load documents</p>
            <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">
              {searchQuery ? 'No documents match your search' : 'No documents yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchQuery ? 'Try a different search term' : 'Create a document in the chat to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => (
                <Link
                  key={`${doc.id}-${doc.createdAt}`}
                  href={`/?documentId=${doc.id}`}
                  className="group block"
                >
                  <div className="border rounded-lg p-4 hover:border-primary hover:shadow-md transition-all duration-200 h-full flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {doc.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistance(new Date(doc.createdAt), new Date(), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {doc.content && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mt-auto">
                        {doc.content}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


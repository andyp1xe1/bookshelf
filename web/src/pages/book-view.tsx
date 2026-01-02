import { useUser } from "@clerk/clerk-react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Share01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  getBookByIdOptions,
  listBookDocumentsOptions,
} from "@/client/@tanstack/react-query.gen";
import { CoverImage } from "@/components/books/cover-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatFileSize } from "@/lib/upload-utils";

export function BookViewPage() {
  const { bookId } = useParams({ from: "/books/$bookId" });
  const navigate = useNavigate();
  const { user } = useUser();

  const {
    data: book,
    isLoading: isLoadingBook,
    error,
  } = useQuery(
    getBookByIdOptions({
      path: { bookID: Number(bookId) },
    })
  );

  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    ...listBookDocumentsOptions({
      path: { bookID: Number(bookId) },
      query: { limit: 50, offset: 0 },
    }),
    enabled: !!book,
  });

  const isOwner = user?.id === book?.userId;
  const documents = documentsData?.items ?? [];

  const handleDocumentClick = (documentId: number) => {
    window.open(
      `${import.meta.env.VITE_API_BASE_URL}/books/${bookId}/documents/${documentId}/download`,
      "_blank"
    );
  };

  const handleShare = () => {
    const url = `${window.location.origin}/books/${bookId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  if (isLoadingBook) {
    return (
      <div className="min-h-screen bg-muted text-muted-foreground">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-muted-foreground">Loading book...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-muted text-muted-foreground">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <h2 className="text-2xl font-bold">Book not found</h2>
            <p className="text-muted-foreground">
              The book you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate({ to: "/" })}>Go to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted text-muted-foreground">
      <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{book.title}</span>
      </nav>

      {/* Action Buttons */}
      <div className="mb-6 flex gap-2">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/" })}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Back
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <HugeiconsIcon icon={Share01Icon} strokeWidth={2} />
          Share
        </Button>
        {isOwner && (
          <Link to="/books/$bookId/edit" params={{ bookId: bookId }}>
            <Button>
              <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
              Edit Book
            </Button>
          </Link>
        )}
      </div>

      {/* Main Content - Desktop: Left/Right Split */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
        {/* Left Column - Cover Image */}
        <div className="flex justify-center lg:justify-start">
          <CoverImage
            src={book.coverUrl}
            alt={book.title}
            size="xl"
            className="shadow-xl"
          />
        </div>

        {/* Right Column - Book Details */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-bold">{book.title}</h1>
              <Badge variant="secondary" className="text-base px-3 py-1">
                {book.publishedYear}
              </Badge>
            </div>
            <p className="text-xl text-muted-foreground">by {book.author}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                ISBN
              </div>
              <div className="text-base font-medium">{book.isbn}</div>
            </div>
            {book.genre && (
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  Genre
                </div>
                <div className="text-base font-medium">{book.genre}</div>
              </div>
            )}
          </div>

          <div className="text-muted-foreground text-xs">
            Catalog ID #{book.id}
          </div>

          <Separator />

          {/* Documents Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Documents</h2>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {documents.length} {documents.length === 1 ? "file" : "files"}
              </Badge>
            </div>

            {isLoadingDocuments ? (
              <div className="py-12 text-center text-muted-foreground">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No documents available
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc.id)}
                    className="w-full border p-4 text-left transition-colors hover:bg-accent hover:border-accent-foreground/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{doc.filename}</div>
                          <Badge variant="secondary" className="text-xs">
                            {doc.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatFileSize(doc.sizeBytes)} • {doc.contentType}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Download →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

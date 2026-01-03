import { useUser } from "@clerk/clerk-react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Share01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  getBookByIdOptions,
} from "@/client/@tanstack/react-query.gen";
import { CoverImage } from "@/components/books/cover-image";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentList } from "@/components/documents/document-list";

export function BookViewPage() {
  const { bookId } = useParams({ from: "/books/$bookId" });
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const {
    data: book,
    isLoading: isLoadingBook,
    error,
  } = useQuery(
    getBookByIdOptions({
      path: { bookID: Number(bookId) },
    })
  );

  const isOwner = user?.id === book?.userId;

  const handleShare = () => {
    const url = `${window.location.origin}/books/${bookId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const handleDocumentDelete = () => {
    queryClient.invalidateQueries({
      queryKey: ["listBookDocuments"],
    });
  };

  if (isLoadingBook) {
    return (
      <AppLayout showBackButton>
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
            {/* Left Column - Cover Skeleton */}
            <div className="flex justify-center lg:justify-start">
              <div className="w-[200px] h-[300px] bg-muted animate-pulse" />
            </div>

            {/* Right Column - Details Skeleton */}
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="h-10 bg-muted animate-pulse w-3/4" />
                <div className="h-6 bg-muted animate-pulse w-1/2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted animate-pulse w-16" />
                  <div className="h-5 bg-muted animate-pulse w-32" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted animate-pulse w-16" />
                  <div className="h-5 bg-muted animate-pulse w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !book) {
    return (
      <AppLayout showBackButton>
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <h2 className="text-2xl font-bold">Book not found</h2>
            <p className="text-muted-foreground">
              The book you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate({ to: "/" })}>Go to Home</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: book.title, href: `/books/${book.id}` },
      ]}
      showBackButton
    >
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Action Buttons */}
        <div className="mb-6 flex gap-2">
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
              className="shadow-xl bg-background"
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
            <DocumentList bookId={book.id} onDelete={isOwner ? handleDocumentDelete : undefined} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

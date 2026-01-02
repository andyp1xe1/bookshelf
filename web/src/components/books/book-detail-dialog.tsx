import { useUser } from "@clerk/clerk-react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Share01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons"

import { listBookDocumentsOptions } from "@/client/@tanstack/react-query.gen"
import type { Book } from "@/client/types.gen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatFileSize } from "@/lib/upload-utils"
import { CoverImage } from "@/components/books/cover-image"

interface BookDetailDialogProps {
  book: Book | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BookDetailDialog({
  book,
  open,
  onOpenChange,
}: BookDetailDialogProps) {
  const { user } = useUser()
  const isOwner = user?.id === book?.userId

  const { data: documentsData, isLoading: isLoadingDocuments } = useQuery({
    ...listBookDocumentsOptions({
      path: { bookID: book?.id ?? 0 },
      query: { limit: 50, offset: 0 },
    }),
    enabled: open && book !== null,
  })

  if (!book) return null

  const documents = documentsData?.items ?? []

  const handleDocumentClick = (bookId: number, documentId: number) => {
    window.open(
      `${import.meta.env.VITE_API_BASE_URL}/books/${bookId}/documents/${documentId}/download`,
      "_blank"
    )
  }

  const handleShare = () => {
    const url = `${window.location.origin}/books/${book.id}`
    navigator.clipboard.writeText(url)
    toast.success("Link copied to clipboard!")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pr-12">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="shrink-0">
              <CoverImage
                src={book.coverUrl}
                alt={book.title}
                size="sm"
                className="mx-auto sm:mx-0"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1 min-w-0">
                  <DialogTitle className="text-2xl break-words">{book.title}</DialogTitle>
                  <DialogDescription className="text-base">
                    by {book.author}
                  </DialogDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">{book.publishedYear}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">
                ISBN
              </div>
              <div className="text-sm font-medium">{book.isbn}</div>
            </div>
            {book.genre && (
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide">
                  Genre
                </div>
                <div className="text-sm font-medium">{book.genre}</div>
              </div>
            )}
          </div>

          <div className="text-muted-foreground text-xs">
            Catalog ID #{book.id}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Documents</h3>
              <Badge variant="secondary">
                {documents.length} {documents.length === 1 ? "file" : "files"}
              </Badge>
            </div>

            {isLoadingDocuments ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No documents available
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocumentClick(book.id, doc.id)}
                    className="w-full border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm break-all">
                            {doc.filename}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {doc.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground break-all">
                          {formatFileSize(doc.sizeBytes)} • {doc.contentType}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              to="/books/$bookId"
              params={{ bookId: book.id.toString() }}
              className="flex-1"
            >
              <Button variant="default" className="w-full">
                Show Details
              </Button>
            </Link>
            <Button variant="outline" onClick={handleShare} className="flex-1 w-full">
              <HugeiconsIcon icon={Share01Icon} strokeWidth={2} />
              Share
            </Button>
            {isOwner && (
              <Link
                to="/books/$bookId/edit"
                params={{ bookId: book.id.toString() }}
                className="flex-1"
              >
                <Button variant="outline" className="w-full">
                  <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                  Edit
                </Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

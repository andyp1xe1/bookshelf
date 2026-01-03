import { useUser } from "@clerk/clerk-react"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Share01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons"

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
import { CoverImage } from "@/components/books/cover-image"
import { DocumentList } from "@/components/documents/document-list"

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

  if (!book) return null

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
                  <DialogTitle className="text-xl break-words">{book.title}</DialogTitle>
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

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold">Documents</h3>

            <DocumentList bookId={book.id} variant="compact" showCard={false} />
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

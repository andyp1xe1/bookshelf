import { useUser } from "@clerk/clerk-react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

import type { Book } from "@/client/types.gen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CoverImage } from "@/components/books/cover-image"

interface BookCardProps {
  book: Book
  onOpenDetail: (book: Book) => void
}

export function BookCard({ book, onOpenDetail }: BookCardProps) {
  const { user } = useUser()
  const isOwner = user?.id === book.userId

  const handleCardClick = () => {
    onOpenDetail(book)
  }

  return (
    <Card size="sm" className="bg-background/80 relative group">
      {isOwner && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to="/books/$bookId/edit"
            params={{ bookId: book.id.toString() }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
              <span className="sr-only">Edit book</span>
            </Button>
          </Link>
        </div>
      )}
      
      <button
        onClick={handleCardClick}
        className="w-full text-left transition-opacity hover:opacity-80"
      >
        <CardHeader>
          <div className="flex gap-4">
            <CoverImage
              src={book.coverUrl}
              alt={book.title}
              size="sm"
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="space-y-1">
                  <CardTitle>{book.title}</CardTitle>
                  <CardDescription>{book.author}</CardDescription>
                </div>
                <Badge variant="secondary">{book.publishedYear}</Badge>
              </div>
              {book.genre && (
                <div className="flex flex-wrap gap-2">
                  <Badge>{book.genre}</Badge>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">
            ISBN
          </div>
          <div className="text-sm font-medium">{book.isbn}</div>
        </CardContent>
        <CardFooter className="text-muted-foreground text-xs">
          Catalog ID #{book.id}
        </CardFooter>
      </button>
    </Card>
  )
}

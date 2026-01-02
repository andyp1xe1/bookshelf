import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import {
  getBookByIdOptions,
  updateBookMutation,
  deleteBookByIdMutation,
} from "@/client/@tanstack/react-query.gen"
import type { BookUpdate } from "@/client/types.gen"
import { DocumentList } from "@/components/documents/document-list"
import { DocumentUploadForm } from "@/components/documents/document-upload-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function BookEditPage() {
  const params = useParams({ strict: false }) as { bookId: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useUser()

  const bookId = Number.parseInt(params.bookId, 10)

  const { data: bookData, isLoading } = useQuery({
    ...getBookByIdOptions({
      path: { bookID: bookId },
    }),
  })

  const [formData, setFormData] = React.useState<BookUpdate>({
    title: "",
    author: "",
    isbn: "",
    publishedYear: "",
    genre: undefined,
  })

  React.useEffect(() => {
    if (bookData) {
      setFormData({
        title: bookData.title,
        author: bookData.author,
        isbn: bookData.isbn,
        publishedYear: bookData.publishedYear,
        genre: bookData.genre || undefined,
      })
    }
  }, [bookData])

  const updateMutation = useMutation({
    ...updateBookMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getBookById"] })
      queryClient.invalidateQueries({ queryKey: ["listBooks"] })
    },
  })

  const deleteMutation = useMutation({
    ...deleteBookByIdMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listBooks"] })
      navigate({ to: "/" })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await updateMutation.mutateAsync({
        path: { bookID: bookId },
        body: formData,
      })
      toast.success("Book updated successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update book")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({
        path: { bookID: bookId },
      })
      toast.success("Book deleted successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete book")
    }
  }

  const handleDocumentUploadSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["listBookDocuments"],
    })
  }

  const isPending = updateMutation.isPending || deleteMutation.isPending

  // Check ownership
  const isOwner = user && bookData && bookData.userId === user.id

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted text-muted-foreground">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading book...
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show access denied if not owner
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-muted text-muted-foreground">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
          <div className="flex items-center justify-between gap-3">
            <Link to="/">
              <Button variant="outline">
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                Back to Catalog
              </Button>
            </Link>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>

          <Card>
            <CardContent className="py-10 text-center">
              <div className="space-y-4">
                <Badge variant="destructive" className="text-lg px-4 py-2">
                  Access Denied
                </Badge>
                <p className="text-muted-foreground">
                  You don't have permission to edit this book.
                </p>
                <Link to="/">
                  <Button variant="outline" className="mt-4">
                    Return to Catalog
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted text-muted-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <div className="flex items-center justify-between gap-3">
          <Link to="/">
            <Button variant="outline">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              Back to Catalog
            </Button>
          </Link>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <Badge variant="destructive">Sign in required</Badge>
          </SignedOut>
        </div>

        <header className="space-y-3">
          <Badge variant="secondary">Book Management</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            Edit Book
          </h1>
          <p className="text-muted-foreground text-sm">
            Update book metadata and manage documents.
          </p>
        </header>

        <Separator />

        <SignedIn>
          <Card>
            <CardHeader>
              <CardTitle>Book Details</CardTitle>
              <CardDescription>
                Enter the book metadata below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="title">Title *</FieldLabel>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                      disabled={isPending}
                    />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="author">Author *</FieldLabel>
                      <Input
                        id="author"
                        value={formData.author}
                        onChange={(e) =>
                          setFormData({ ...formData, author: e.target.value })
                        }
                        required
                        disabled={isPending}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="isbn">ISBN *</FieldLabel>
                      <Input
                        id="isbn"
                        value={formData.isbn}
                        onChange={(e) =>
                          setFormData({ ...formData, isbn: e.target.value })
                        }
                        required
                        disabled={isPending}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="publishedYear">
                        Published Year *
                      </FieldLabel>
                      <Input
                        id="publishedYear"
                        value={formData.publishedYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            publishedYear: e.target.value,
                          })
                        }
                        placeholder="e.g. 2024"
                        required
                        disabled={isPending}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="genre">Genre</FieldLabel>
                      <Input
                        id="genre"
                        value={formData.genre || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            genre: e.target.value || undefined,
                          })
                        }
                        placeholder="Optional"
                        disabled={isPending}
                      />
                    </Field>
                  </div>

                  <Field orientation="horizontal" className="flex justify-between">
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isPending}>
                        {updateMutation.isPending ? "Saving..." : "Update Book"}
                      </Button>
                      <Link to="/">
                        <Button variant="outline" type="button">
                          Cancel
                        </Button>
                      </Link>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="self-end"
                          variant="destructive"
                          type="button"
                          disabled={isPending}
                        >
                          Delete Book
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Are you sure?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{bookData?.title}" and all its documents.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>
                Upload PDF or EPUB files (max 20MB).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUploadForm
                bookId={bookId}
                onSuccess={handleDocumentUploadSuccess}
              />
            </CardContent>
          </Card>

          <DocumentList bookId={bookId} />
        </SignedIn>

        <SignedOut>
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Please sign in to edit books.
            </CardContent>
          </Card>
        </SignedOut>
      </div>
    </div>
  )
}

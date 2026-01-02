import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { createBookMutation } from "@/client/@tanstack/react-query.gen"
import { lookupBookByIsbn } from "@/client/sdk.gen"
import type { BookCreate, BookMetadata, ContentType } from "@/client/types.gen"
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
import { FileInput } from "@/components/ui/file-input"
import { Input } from "@/components/ui/input"
import { CoverImage } from "@/components/books/cover-image"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  calculateSHA256,
  formatFileSize,
  validateFile,
} from "@/lib/upload-utils"
import {
  completeBookDocumentUploadMutation,
  createBookDocumentPresignMutation,
} from "@/client/@tanstack/react-query.gen"

interface DocumentToUpload {
  file: File
  status: "pending" | "uploading" | "completed" | "error"
  progress: number
  error?: string
}

export function BookCreatePage() {
  const navigate = useNavigate()
  
  const [formData, setFormData] = React.useState<BookCreate>({
    title: "",
    author: "",
    isbn: "",
    publishedYear: "",
    genre: undefined,
  })

  const [documents, setDocuments] = React.useState<DocumentToUpload[]>([])
  const [createdBookId, setCreatedBookId] = React.useState<number | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = React.useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = React.useState(false)

  const createMutation = useMutation(createBookMutation())
  const presignMutation = useMutation(createBookDocumentPresignMutation())
  const completeMutation = useMutation(completeBookDocumentUploadMutation())

  const handleAutofill = async () => {
    if (!formData.isbn) {
      toast.error("Please enter an ISBN first")
      return
    }

    setIsLookingUp(true)
    try {
      const result = await lookupBookByIsbn({
        path: { isbn: formData.isbn }
      })

      const metadata = result.data as BookMetadata
      
      // Autofill form fields
      setFormData({
        ...formData,
        title: metadata.title || formData.title,
        author: metadata.author || formData.author,
        publishedYear: metadata.publishedYear || formData.publishedYear,
        genre: metadata.genre || formData.genre,
      })

      // Set cover preview if available
      if (metadata.coverUrl) {
        setCoverPreviewUrl(metadata.coverUrl)
      }
      
      toast.success("Book information retrieved successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to lookup ISBN")
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return

    const newDocs: DocumentToUpload[] = Array.from(files).map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }))

    setDocuments((prev) => [...prev, ...newDocs])
  }

  const handleRemoveFile = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadDocument = async (
    bookId: number,
    doc: DocumentToUpload,
    index: number
  ) => {
    try {
      setDocuments((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], status: "uploading", progress: 10 }
        return updated
      })

      const validation = validateFile(doc.file)
      if (!validation.valid) {
        throw new Error(validation.error || "File validation failed")
      }

      const checksum = await calculateSHA256(doc.file)

      setDocuments((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], progress: 30 }
        return updated
      })

      const presignResponse = await presignMutation.mutateAsync({
        path: { bookID: bookId },
        body: {
          filename: doc.file.name,
          contentType: validation.contentType as ContentType,
          sizeBytes: doc.file.size,
          checksumSha256Hex: checksum,
        },
      })

      const { uploadUrl, document } = presignResponse

      setDocuments((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], progress: 40 }
        return updated
      })

      const xhr = new XMLHttpRequest()

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 50)
            setDocuments((prev) => {
              const updated = [...prev]
              updated[index] = { ...updated[index], progress: 40 + percentComplete }
              return updated
            })
          }
        })

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"))
        })

        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", validation.contentType as string)
        xhr.send(doc.file)
      })

      setDocuments((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], progress: 95 }
        return updated
      })

      await completeMutation.mutateAsync({
        path: {
          bookID: bookId,
          documentID: document.id,
        },
      })

      setDocuments((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], status: "completed", progress: 100 }
        return updated
      })
    } catch (err) {
      setDocuments((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        }
        return updated
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await createMutation.mutateAsync({
        body: formData,
      })

      // Store the created book ID for potential retries
      setCreatedBookId(response.id)

      // Upload documents sequentially
      for (let i = 0; i < documents.length; i++) {
        if (documents[i].status === "pending") {
          await uploadDocument(response.id, documents[i], i)
        }
      }

      // Check if any uploads failed
      const failedCount = documents.filter(d => d.status === "error").length

      if (failedCount > 0) {
        // Don't redirect if there are failures - let user retry
        return
      }

      // Navigate to home after successful uploads
      if (documents.length > 0) {
        toast.success("Book created successfully!")
        // Show success message briefly before redirect
        setTimeout(() => {
          navigate({ to: "/" })
        }, 2000)
      } else {
        toast.success("Book created successfully!")
        // No documents, redirect immediately
        navigate({ to: "/" })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create book")
    }
  }

  const handleRetry = async (index: number) => {
    if (!createdBookId) return
    
    // Reset the document status to pending
    setDocuments((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], status: "pending", progress: 0, error: undefined }
      return updated
    })

    // Retry the upload
    await uploadDocument(createdBookId, documents[index], index)
  }

  const isPending = createMutation.isPending
  const isUploading = documents.some((d) => d.status === "uploading")
  const uploadComplete = createdBookId && documents.length > 0 && !isUploading && documents.every((d) => d.status === "completed")
  const completedCount = documents.filter((d) => d.status === "completed").length
  const failedCount = documents.filter((d) => d.status === "error").length

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
            Create New Book
          </h1>
          <p className="text-muted-foreground text-sm">
            Fill in the book details and optionally upload documents.
          </p>
        </header>

        <Separator />

        <SignedIn>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Book Details</CardTitle>
                <CardDescription>
                  Enter the book metadata below.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      disabled={isPending || isUploading}
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
                        disabled={isPending || isUploading}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="isbn">ISBN *</FieldLabel>
                      <div className="flex gap-2">
                        <Input
                          id="isbn"
                          value={formData.isbn}
                          onChange={(e) =>
                            setFormData({ ...formData, isbn: e.target.value })
                          }
                          required
                          disabled={isPending || isUploading}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAutofill}
                          disabled={isPending || isUploading || isLookingUp || !formData.isbn}
                        >
                          {isLookingUp ? "..." : "Autofill"}
                        </Button>
                      </div>
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
                        disabled={isPending || isUploading}
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
                        disabled={isPending || isUploading}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            {coverPreviewUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Cover Preview</CardTitle>
                  <CardDescription>
                    Cover image from OpenLibrary
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <CoverImage 
                    src={coverPreviewUrl}
                    alt={formData.title || "Book cover"}
                    size="lg"
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Documents (Optional)</CardTitle>
                <CardDescription>
                  Add PDF or EPUB files to upload with the book.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileInput
                  multiple
                  onChange={(e) => handleAddFiles(e.target.files)}
                  disabled={isPending || isUploading}
                />

                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <div
                        key={index}
                        className="border p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {doc.file.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file.size)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.status === "pending" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                                disabled={isPending || isUploading}
                              >
                                Remove
                              </Button>
                            )}
                            {doc.status === "completed" && (
                              <Badge variant="default" className="bg-green-600">
                                Uploaded
                              </Badge>
                            )}
                            {doc.status === "error" && (
                              <>
                                <Badge variant="destructive">Failed</Badge>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRetry(index)}
                                  disabled={isUploading}
                                >
                                  Retry
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {doc.status === "uploading" && (
                          <div className="space-y-1">
                            <Progress value={doc.progress} />
                            <div className="text-xs text-muted-foreground">
                              Uploading... {doc.progress}%
                            </div>
                          </div>
                        )}
                        {doc.status === "error" && doc.error && (
                          <div className="text-xs text-destructive">
                            {doc.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {uploadComplete && (
              <Card className="border-green-600 bg-green-950/20">
                <CardContent className="py-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600">
                      <svg
                        className="h-6 w-6 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-600">Book Created Successfully!</h3>
                      <p className="text-sm text-muted-foreground">
                        {completedCount} {completedCount === 1 ? 'document' : 'documents'} uploaded successfully. Redirecting to catalog...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {failedCount > 0 && createdBookId && (
              <Card className="border-yellow-600 bg-yellow-950/20">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-600">
                      <svg
                        className="h-6 w-6 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-600">Upload Issues Detected</h3>
                      <p className="text-sm text-muted-foreground">
                        {failedCount} {failedCount === 1 ? 'document' : 'documents'} failed to upload. Click "Retry" to try again.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending || isUploading}>
                {isPending
                  ? "Creating Book..."
                  : isUploading
                    ? "Uploading Documents..."
                    : "Create Book"}
              </Button>
              <Link to="/">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </SignedIn>

        <SignedOut>
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Please sign in to create books.
            </CardContent>
          </Card>
        </SignedOut>
      </div>
    </div>
  )
}

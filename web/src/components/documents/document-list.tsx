import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  deleteBookDocumentByIdMutation,
  listBookDocumentsOptions,
} from "@/client/@tanstack/react-query.gen"
import type { Document } from "@/client/types.gen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatFileSize } from "@/lib/upload-utils"

interface DocumentListProps {
  bookId: number
  variant?: "compact" | "detailed"
  onDelete?: () => void
  showCard?: boolean
}

interface DocumentItemProps {
  doc: Document
  bookId: number
  variant: "compact" | "detailed"
  onDelete?: () => void
}

function DocumentItem({
  doc,
  bookId,
  variant,
  onDelete,
}: DocumentItemProps) {
  const deleteMutation = useMutation({
    ...deleteBookDocumentByIdMutation(),
    onSuccess: onDelete,
  })

  const handleDelete = async () => {
    if (!confirm(`Delete ${doc.filename}?`)) return

    try {
      await deleteMutation.mutateAsync({
        path: {
          bookID: bookId,
          documentID: doc.id,
        },
      })
      toast.success("Document deleted successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document")
    }
  }

  const handleDownload = () => {
    window.open(
      `${import.meta.env.VITE_API_BASE_URL}/books/${bookId}/documents/${doc.id}/download`,
      "_blank"
    )
  }

  const statusColor = {
    pending: "secondary",
    processing: "secondary",
    ready: "default",
    failed: "destructive",
  } as const

  if (variant === "compact") {
    return (
      <button
        onClick={handleDownload}
        className="w-full border p-3 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-medium text-sm break-all">
                {doc.filename}
              </div>
              {doc.status !== "uploaded" &&
                <Badge variant={statusColor[doc.status]} className="text-xs shrink-0">
                  {doc.status}
                </Badge>
              }
            </div>
            <div className="text-xs text-muted-foreground break-all">
              {formatFileSize(doc.sizeBytes)} • {doc.contentType}
            </div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 border p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <div className="font-medium">{doc.filename}</div>
          {doc.status !== "uploaded" &&
            <Badge variant={statusColor[doc.status]}>{doc.status}</Badge>
          }
        </div>
        <div className="text-sm text-muted-foreground">
          {formatFileSize(doc.sizeBytes)} • {doc.contentType}
        </div>
        <div className="text-xs text-muted-foreground">
          Uploaded {new Date(doc.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div className="flex gap-2">
        {doc.status === "uploaded" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            Download
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </div>
  )
}

export function DocumentList({
  bookId,
  variant = "detailed",
  onDelete,
  showCard = true,
}: DocumentListProps) {
  const { data, isLoading, isError, error, refetch } = useQuery(
    listBookDocumentsOptions({
      path: { bookID: bookId },
      query: { limit: 50, offset: 0 },
    })
  )

  const handleDeleteSuccess = () => {
    refetch()
    onDelete?.()
  }

  const documents = data?.items ?? []

  const renderContent = () => {
    if (isLoading) {
      const skeletonContent = variant === "compact" ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              {i > 0 && <Separator className="my-4" />}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )

      if (variant === "detailed" && showCard) {
        return (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              {skeletonContent}
            </CardContent>
          </Card>
        )
      }

      return (
        <div className="py-8">
          {skeletonContent}
        </div>
      )
    }

    if (isError) {
      return variant === "detailed" && showCard ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load documents"}
          </CardContent>
        </Card>
      ) : (
        <div className="py-8 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load documents"}
        </div>
      )
    }

    if (documents.length === 0) {
      return variant === "detailed" && showCard ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {variant === "detailed" ? "No documents uploaded yet. Upload your first document above." : "No documents available"}
          </CardContent>
        </Card>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {variant === "detailed" ? "No documents uploaded yet. Upload your first document above." : "No documents available"}
        </div>
      )
    }

    const documentItems = (
      <div className={variant === "compact" ? "space-y-2" : "space-y-4"}>
        {documents.map((doc, index) => (
          <div key={doc.id}>
            {variant === "detailed" && index > 0 && <Separator className="my-4" />}
            <DocumentItem
              doc={doc}
              bookId={bookId}
              variant={variant}
              onDelete={onDelete ? handleDeleteSuccess : undefined}
            />
          </div>
        ))}
      </div>
    )

    if (variant === "detailed" && showCard) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {data?.total} {data?.total === 1 ? "document" : "documents"} uploaded
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {documentItems}
          </CardContent>
        </Card>
      )
    }

    return documentItems
  }

  return <>{renderContent()}</>
}

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
import { formatFileSize } from "@/lib/upload-utils"

interface DocumentListProps {
  bookId: number
}

function DocumentItem({
  doc,
  bookId,
  onDelete,
}: {
  doc: Document
  bookId: number
  onDelete: () => void
}) {
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
      `/books/${bookId}/documents/${doc.id}/download`,
      "_blank"
    )
  }

  const statusColor = {
    pending: "secondary",
    uploaded: "default",
    processing: "secondary",
    ready: "default",
    failed: "destructive",
  } as const

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <div className="font-medium">{doc.filename}</div>
          <Badge variant={statusColor[doc.status]}>{doc.status}</Badge>
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  )
}

export function DocumentList({ bookId }: DocumentListProps) {
  const { data, isLoading, isError, error, refetch } = useQuery(
    listBookDocumentsOptions({
      path: { bookID: bookId },
      query: { limit: 50, offset: 0 },
    })
  )

  const handleDeleteSuccess = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading documents...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load documents"}
        </CardContent>
      </Card>
    )
  }

  const documents = data?.items ?? []

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No documents uploaded yet. Upload your first document above.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          {data?.total} {data?.total === 1 ? "document" : "documents"} uploaded
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.map((doc, index) => (
          <div key={doc.id}>
            {index > 0 && <Separator className="my-4" />}
            <DocumentItem
              doc={doc}
              bookId={bookId}
              onDelete={handleDeleteSuccess}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

import { useMutation } from "@tanstack/react-query"
import * as React from "react"

import {
  completeBookDocumentUploadMutation,
  createBookDocumentPresignMutation,
} from "@/client/@tanstack/react-query.gen"
import type { ContentType } from "@/client/types.gen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { FileInput } from "@/components/ui/file-input"
import { Progress } from "@/components/ui/progress"
import {
  calculateSHA256,
  formatFileSize,
  validateFile,
} from "@/lib/upload-utils"

type UploadStatus =
  | "idle"
  | "validating"
  | "requesting-presign"
  | "uploading"
  | "completing"
  | "success"
  | "error"

interface DocumentUploadFormProps {
  bookId: number
  onSuccess?: () => void
}

export function DocumentUploadForm({
  bookId,
  onSuccess,
}: DocumentUploadFormProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState<UploadStatus>("idle")
  const [progress, setProgress] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const presignMutation = useMutation(createBookDocumentPresignMutation())

  const completeMutation = useMutation(completeBookDocumentUploadMutation())

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile)
    setError(null)
    setStatus("idle")
    setProgress(0)
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      // Step 1: Validate file
      setStatus("validating")
      setProgress(10)
      const validation = validateFile(file)
      if (!validation.valid) {
        setError(validation.error || "File validation failed")
        setStatus("error")
        return
      }

      // Step 2: Calculate SHA-256 checksum
      setProgress(20)
      const checksum = await calculateSHA256(file)

      // Step 3: Request presigned URL
      setStatus("requesting-presign")
      setProgress(30)
      const presignResponse = await presignMutation.mutateAsync({
        path: { bookID: bookId },
        body: {
          filename: file.name,
          contentType: validation.contentType as ContentType,
          sizeBytes: file.size,
          checksumSha256Hex: checksum,
        },
      })

      const { uploadUrl, document } = presignResponse

      // Step 4: Upload to R2
      setStatus("uploading")
      setProgress(40)

      const xhr = new XMLHttpRequest()

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 50)
            setProgress(40 + percentComplete)
          }
        })

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(
              new Error(`Upload failed with status ${xhr.status}`)
            )
          }
        })

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"))
        })

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted"))
        })

        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", validation.contentType as string)
        xhr.send(file)
      })

      // Step 5: Complete upload
      setStatus("completing")
      setProgress(95)
      await completeMutation.mutateAsync({
        path: {
          bookID: bookId,
          documentID: document.id,
        },
      })

      setStatus("success")
      setProgress(100)
      setFile(null)
      onSuccess?.()
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Upload failed")
    }
  }

  const isUploading = ["validating", "requesting-presign", "uploading", "completing"].includes(
    status
  )

  const getStatusMessage = () => {
    switch (status) {
      case "validating":
        return "Validating file..."
      case "requesting-presign":
        return "Preparing upload..."
      case "uploading":
        return "Uploading to storage..."
      case "completing":
        return "Finalizing upload..."
      case "success":
        return `${file?.name || "Document"} uploaded successfully!`
      case "error":
        return error || "Upload failed"
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="document-file">Document File</FieldLabel>
        <FileInput
          id="document-file"
          onFileChange={handleFileChange}
          disabled={isUploading}
        />
        {file && (
          <div className="mt-2 text-sm text-muted-foreground">
            {file.name} ({formatFileSize(file.size)})
          </div>
        )}
      </Field>

      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="text-sm text-muted-foreground">
            {getStatusMessage()}
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="rounded-lg border border-green-600/20 bg-green-600/10 p-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600 hover:bg-green-600">
              ✓
            </Badge>
            <span className="text-sm font-medium text-green-600">
              {getStatusMessage()}
            </span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="text-sm text-destructive">{getStatusMessage()}</div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || isUploading || status === "success"}
        type="button"
      >
        {isUploading ? "Uploading..." : "Upload Document"}
      </Button>
    </div>
  )
}

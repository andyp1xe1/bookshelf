export const ALLOWED_CONTENT_TYPES = {
  "application/pdf": ".pdf",
  "application/epub+zip": ".epub",
} as const

export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES

export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

export async function calculateSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return hashHex
}

export function validateFileType(file: File): {
  valid: boolean
  contentType?: AllowedContentType
  error?: string
} {
  const contentType = file.type as AllowedContentType
  
  if (!Object.keys(ALLOWED_CONTENT_TYPES).includes(contentType)) {
    return {
      valid: false,
      error: `Invalid file type. Only PDF and EPUB files are allowed.`,
    }
  }

  return { valid: true, contentType }
}

export function validateFileSize(file: File): {
  valid: boolean
  error?: string
} {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  return { valid: true }
}

export function validateFile(file: File): {
  valid: boolean
  contentType?: AllowedContentType
  error?: string
} {
  const typeCheck = validateFileType(file)
  if (!typeCheck.valid) {
    return typeCheck
  }

  const sizeCheck = validateFileSize(file)
  if (!sizeCheck.valid) {
    return sizeCheck
  }

  return { valid: true, contentType: typeCheck.contentType }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

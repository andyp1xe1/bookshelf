import * as React from "react"

import { cn } from "@/lib/utils"
import { ALLOWED_CONTENT_TYPES } from "@/lib/upload-utils"

export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onFileChange?: (file: File | null) => void
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, onFileChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null
      onFileChange?.(file)
      props.onChange?.(e)
    }

    return (
      <input
        type="file"
        accept={Object.keys(ALLOWED_CONTENT_TYPES).join(",")}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
FileInput.displayName = "FileInput"

export { FileInput }

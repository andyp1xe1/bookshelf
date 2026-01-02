import { cn } from "@/lib/utils";

interface CoverImageProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, height: 120 },
  md: { width: 150, height: 225 },
  lg: { width: 200, height: 300 },
  xl: { width: 300, height: 450 },
};

export function CoverImage({
  src,
  alt,
  size = "md",
  className,
}: CoverImageProps) {
  const { width, height } = sizeConfig[size];

  if (!src) {
    return (
      <div
        className={cn("bg-muted", className)}
        style={{ width, height }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      style={{ width, height }}
      loading="lazy"
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
        const placeholder = document.createElement("div");
        placeholder.className = "bg-muted";
        placeholder.style.width = `${width}px`;
        placeholder.style.height = `${height}px`;
        target.parentNode?.insertBefore(placeholder, target);
      }}
    />
  );
}

import { cn } from "@/lib/utils";

interface CoverImageProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, height: 120, iconSize: 32 },
  md: { width: 150, height: 225, iconSize: 48 },
  lg: { width: 200, height: 300, iconSize: 64 },
  xl: { width: 300, height: 450, iconSize: 96 },
};

export function CoverImage({
  src,
  alt,
  size = "md",
  className,
}: CoverImageProps) {
  const { width, height, iconSize } = sizeConfig[size];

  if (!src) {
    return (
      <div
        className={cn("bg-muted flex items-center justify-center", className)}
        style={{ width, height }}
      >
        <img
          src="/favicon.png"
          alt="Book placeholder"
          style={{ width: iconSize, height: iconSize }}
          className="opacity-70"
        />
      </div>
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
        placeholder.className = "bg-muted flex items-center justify-center";
        placeholder.style.width = `${width}px`;
        placeholder.style.height = `${height}px`;

        const icon = document.createElement("img");
        icon.src = "/favicon.png";
        icon.alt = "Book placeholder";
        icon.style.width = `${iconSize}px`;
        icon.style.height = `${iconSize}px`;
        icon.className = "opacity-30";

        placeholder.appendChild(icon);
        target.parentNode?.insertBefore(placeholder, target);
      }}
    />
  );
}

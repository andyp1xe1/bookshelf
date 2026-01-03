import { useHealthCheck } from "@/hooks/useHealthCheck"

export function Footer() {
  const { isHealthy, isChecking } = useHealthCheck()

  const healthStatus = isChecking
    ? { color: "bg-yellow-500", text: "Checking...", animate: "animate-pulse" }
    : isHealthy
      ? { color: "bg-primary", text: "All systems operational", animate: "" }
      : { color: "bg-red-500", text: "Issues detected", animate: "animate-pulse" }

  return (
    <footer className="border-t border-border bg-background/50">
      <div className="container mx-auto px-6 py-4 flex gap-4 justify-between items-center">
        <div className="text-xs text-muted-foreground">
          {"Copyright © 2026 Chillguys. All rights reserved."}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`h-2 w-2 rounded-full ${healthStatus.color} ${healthStatus.animate}`} />
          <span>{healthStatus.text}</span>
        </div>
      </div>
    </footer>
  )
}

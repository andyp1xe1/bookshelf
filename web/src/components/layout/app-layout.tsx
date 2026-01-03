import type { ReactNode } from "react"
import { NavBar } from "./navbar"
import { Footer } from "./footer"

export interface Breadcrumb {
  label: string
  href: string
}

interface AppLayoutProps {
  children: ReactNode
  breadcrumbs?: Breadcrumb[]
  showBackButton?: boolean
}

export function AppLayout({ children, breadcrumbs, showBackButton }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-muted text-muted-foreground flex flex-col">
      <NavBar breadcrumbs={breadcrumbs} showBackButton={showBackButton} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

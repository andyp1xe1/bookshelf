import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"

interface Breadcrumb {
  label: string
  href: string
}

interface NavBarProps {
  breadcrumbs?: Breadcrumb[]
  showBackButton?: boolean
}

export function NavBar({ breadcrumbs, showBackButton }: NavBarProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      navigate({ to: "/" })
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + Breadcrumbs */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Link
              to="/"
              className="font-semibold text-lg whitespace-nowrap text-primary hover:text-primary/80 transition-colors"
            >
              Bookshelf
            </Link>

            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                {breadcrumbs.map((crumb, _) => (
                  <div key={crumb.href} className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground/50">/</span>
                    <Link
                      to={crumb.href}
                      className="hover:text-foreground transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  </div>
                ))}
              </nav>
            )}
          </div>

          {/* Right: Back + Auth */}
          <div className="flex items-center gap-3 shrink-0">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="hidden sm:flex"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                Back
              </Button>
            )}

            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">Sign up</Button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  )
}

import { ClerkProvider, useAuth } from "@clerk/clerk-react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"

import "./index.css"
import { client } from "./client/client.gen.ts"
import { router } from "./router"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key")
}

const ClientConf = () => {
  const { getToken } = useAuth()
  useEffect(() => {
    client.setConfig({
      baseUrl: import.meta.env.VITE_API_BASE_URL,
      auth: async () => {
        return await getToken() || undefined
      },
    })
  }, [getToken])
  return null
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY} 
      afterSignOutUrl="/"
      appearance={{
        baseTheme: undefined,
        variables: {
          colorBackground: 'oklch(0.205 0 0)',
          colorInputBackground: 'oklch(1 0 0 / 15%)',
          colorInputText: 'oklch(0.985 0 0)',
          colorText: 'oklch(0.985 0 0)',
          colorTextSecondary: 'oklch(0.708 0 0)',
          colorPrimary: 'oklch(0.77 0.20 131)',
          colorDanger: 'oklch(0.704 0.191 22.216)',
          colorSuccess: 'oklch(0.77 0.20 131)',
          colorWarning: 'oklch(0.85 0.21 129)',
          colorNeutral: 'oklch(0.985 0 0)',
          borderRadius: '0',
          fontFamily: 'JetBrains Mono Variable, monospace',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ClientConf />
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors theme="dark" />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
)

import { ClerkProvider, useAuth } from "@clerk/clerk-react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { client } from "./client/client.gen.ts"

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
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <ClientConf />
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
)

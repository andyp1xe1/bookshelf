import { useQuery } from "@tanstack/react-query"

export function useHealthCheck() {
  const { data, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/healthz`
        )
        return response.ok
      } catch {
        return false
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 1,
    staleTime: 30000,
  })

  return {
    isHealthy: data ?? true,
    isChecking: isLoading,
  }
}

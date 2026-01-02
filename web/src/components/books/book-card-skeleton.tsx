import {
  Card,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function BookCardSkeleton() {
  return (
    <Card size="sm" className="bg-background/80">
      <CardHeader>
        <div className="flex gap-4">
          {/* Cover image skeleton */}
          <Skeleton className="h-24 w-16 shrink-0" />
          
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                {/* Title skeleton */}
                <Skeleton className="h-5 w-3/4" />
                {/* Author skeleton */}
                <Skeleton className="h-4 w-1/2" />
              </div>
              {/* Year badge skeleton */}
              <Skeleton className="h-5 w-12" />
            </div>
            {/* Genre badge skeleton */}
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex items-center justify-between">
        {/* ISBN skeleton */}
        <Skeleton className="h-4 w-32" />
      </CardFooter>
    </Card>
  )
}

// GCC - route-level loading state.
import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="container flex min-h-[60vh] flex-col justify-center py-16"
    >
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true" className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <Skeleton variant="circle" className="h-9 w-9" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="mt-8 h-10 w-3/4 sm:h-14" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Skeleton variant="block" className="h-32" />
          <Skeleton variant="block" className="h-32" />
          <Skeleton variant="block" className="h-32" />
        </div>
      </div>
    </div>
  );
}

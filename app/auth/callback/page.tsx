import { Suspense } from "react";
import { AuthCallbackClient } from "./auth-callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}

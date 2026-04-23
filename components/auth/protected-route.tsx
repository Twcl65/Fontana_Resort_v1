"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppUserRole, fetchCurrentUserWithRole, getRedirectForRole } from "@/lib/auth";

type ProtectedRouteProps = {
  requiredRole: AppUserRole;
  children: ReactNode;
};

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      try {
        const current = await fetchCurrentUserWithRole();
        if (!isMounted) return;

        if (!current) {
          router.replace("/login");
          return;
        }

        if (current.dbUser.role !== requiredRole) {
          router.replace(getRedirectForRole(current.dbUser.role));
          return;
        }

        setIsAuthorized(true);
      } catch {
        if (!isMounted) return;
        router.replace("/login");
      }
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [requiredRole, router]);

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}

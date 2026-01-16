"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check authentication status
    const authed = isAuthenticated();
    setIsAuthed(authed);
    setIsChecking(false);

    // If not authenticated and not on login page, redirect to login
    if (!authed && pathname !== "/login") {
      router.replace("/login");
    }

    // If authenticated and on login page, redirect to home
    if (authed && pathname === "/login") {
      router.replace("/");
    }
  }, [pathname, router]);

  // Show nothing while checking auth (prevents flash)
  if (isChecking) {
    return null;
  }

  // If on login page, always show it (handles its own auth redirect)
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // If not authenticated, show nothing (redirect is happening)
  if (!isAuthed) {
    return null;
  }

  // Authenticated - show the app
  return <>{children}</>;
}

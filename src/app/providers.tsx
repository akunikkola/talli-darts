"use client";

import { DataProvider } from "@/context/DataContext";
import AuthGuard from "@/components/AuthGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DataProvider>{children}</DataProvider>
    </AuthGuard>
  );
}

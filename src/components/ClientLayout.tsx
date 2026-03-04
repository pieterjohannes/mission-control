"use client";
import { ToastProvider } from "./ToastProvider";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

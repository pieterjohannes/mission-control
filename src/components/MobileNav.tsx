"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Dashboard", icon: "🏠", key: "home" },
  { href: "/kanban", label: "Kanban", icon: "🗂️", key: "kanban" },
  { href: "/projects", label: "Projects", icon: "📋", key: "projects" },
  { href: "/ideas", label: "Ideas", icon: "💡", key: "ideas" },
  { href: "/activity", label: "Activity", icon: "📊", key: "activity" },
  { href: "/domains", label: "More", icon: "⋯", key: "more" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const active =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href) ||
              (tab.key === "more" && (pathname.startsWith("/domains") || pathname.startsWith("/explorer")));
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`mobile-tab ${active ? "mobile-tab-active" : ""}`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

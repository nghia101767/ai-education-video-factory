"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  ["/dashboard", "⌂", "Dashboard"], ["/dashboard/subjects", "◈", "Subjects"], ["/dashboard/grades", "▣", "Grades"],
  ["/dashboard/textbooks", "☷", "Textbooks"], ["/dashboard/lessons", "✎", "Lessons"], ["/dashboard/assets", "◇", "Assets"], ["/dashboard/characters", "♙", "Characters"], ["/dashboard/styles", "◐", "Styles"], ["/dashboard/videos", "▹", "Videos"],
  ["/dashboard/render-queue", "◷", "Render Queue"], ["/dashboard/batch", "◉", "Batch"], ["/dashboard/analytics", "↗", "Analytics"], ["/dashboard/analytics/cost", "$", "AI Cost"],
  ["/dashboard/youtube", "▶", "YouTube"], ["/dashboard/settings", "⚙", "Settings"], ["/dashboard/help", "?", "Hướng dẫn"],
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/login"); };
  return <div className="shell"><aside><div className="brand"><span>✦</span><div><strong>EDU FACTORY</strong><small>AI VIDEO STUDIO</small></div></div><nav>{links.map(([href, icon, label]) => { const active = pathname === href || (href !== "/dashboard" && href !== "/dashboard/analytics" && pathname.startsWith(`${href}/`)); return <Link className={active ? "active" : ""} href={href} key={href}><span>{icon}</span>{label}</Link>; })}</nav><div className="profile"><div className="avatar">A</div><div><b>Admin</b><small>Workspace owner</small></div><button aria-label="Log out" title="Log out" onClick={logout}>↪</button></div></aside>{children}</div>;
}

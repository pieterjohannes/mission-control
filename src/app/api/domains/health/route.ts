import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/domains/health?days=90
 * Returns domain health summary + domains expiring within the window.
 */
export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90", 10);
  const db = getDb();

  // Total active domains
  const totalRow = db.prepare("SELECT COUNT(*) as count FROM domains WHERE status = 'active'").get() as { count: number };

  // Domains by category
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM domains WHERE status = 'active' 
    GROUP BY category ORDER BY count DESC
  `).all() as { category: string; count: number }[];

  // Parse expiry dates (format: MM/DD/YYYY) and find those within window
  const allDomains = db.prepare(`
    SELECT d.id, d.domain, d.expiry_date, d.category, d.auto_renew, p.name as project_name
    FROM domains d
    LEFT JOIN projects p ON d.project_id = p.id
    WHERE d.status = 'active' AND d.expiry_date IS NOT NULL
  `).all() as { id: number; domain: string; expiry_date: string; category: string; auto_renew: number; project_name: string | null }[];

  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const expiringSoon: Array<{
    id: number;
    domain: string;
    expiry_date: string;
    days_left: number;
    category: string;
    auto_renew: boolean;
    project_name: string | null;
  }> = [];

  let expired = 0;

  for (const d of allDomains) {
    // Parse MM/DD/YYYY
    const parts = d.expiry_date.split("/");
    if (parts.length !== 3) continue;
    const expiryDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (daysLeft < 0) {
      expired++;
    } else if (expiryDate <= cutoff) {
      expiringSoon.push({
        id: d.id,
        domain: d.domain,
        expiry_date: d.expiry_date,
        days_left: daysLeft,
        category: d.category,
        auto_renew: d.auto_renew === 1,
        project_name: d.project_name,
      });
    }
  }

  expiringSoon.sort((a, b) => a.days_left - b.days_left);

  // Domains without auto-renew
  const noAutoRenew = db.prepare("SELECT COUNT(*) as count FROM domains WHERE status = 'active' AND auto_renew = 0").get() as { count: number };

  return NextResponse.json({
    total_active: totalRow.count,
    expired,
    expiring_within_days: days,
    expiring_count: expiringSoon.length,
    no_auto_renew: noAutoRenew.count,
    by_category: byCategory,
    expiring_soon: expiringSoon,
  });
}

import { Router } from "express";
import { db } from "../db.js";
import { users, workspaces, usageLog, jobs, contacts, agentRuns, outreach, workspaceMembers } from "@shared/schema";
import { eq, desc, sql, count, ne } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAdmin);

// GET /api/admin/workspaces
router.get("/workspaces", async (_req, res) => {
  try {
    const ws = await db.select({
      id: workspaces.id,
      name: workspaces.name,
      plan: workspaces.plan,
      credits: workspaces.credits,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    }).from(workspaces).orderBy(desc(workspaces.createdAt)).limit(200);

    // Enrich with per-workspace job + contact counts
    const wsIds = ws.map(w => w.id);
    const [jobCounts, contactCounts, userCounts] = await Promise.all([
      wsIds.length > 0
        ? db.select({ workspaceId: jobs.workspaceId, count: sql<number>`count(*)` })
            .from(jobs).where(sql`workspace_id = ANY(${wsIds})`).groupBy(jobs.workspaceId)
        : Promise.resolve([]),
      wsIds.length > 0
        ? db.select({ workspaceId: contacts.workspaceId, count: sql<number>`count(*)` })
            .from(contacts).where(sql`workspace_id = ANY(${wsIds})`).groupBy(contacts.workspaceId)
        : Promise.resolve([]),
      wsIds.length > 0
        ? db.select({ workspaceId: workspaceMembers.workspaceId, count: sql<number>`count(*)` })
            .from(workspaceMembers).where(sql`workspace_id = ANY(${wsIds})`).groupBy(workspaceMembers.workspaceId)
        : Promise.resolve([]),
    ]);

    const jobMap = Object.fromEntries(jobCounts.map(r => [r.workspaceId, Number(r.count)]));
    const contactMap = Object.fromEntries(contactCounts.map(r => [r.workspaceId, Number(r.count)]));
    const userMap = Object.fromEntries(userCounts.map(r => [r.workspaceId, Number(r.count)]));

    res.json(ws.map(w => ({
      ...w,
      jobCount: jobMap[w.id] ?? 0,
      contactCount: contactMap[w.id] ?? 0,
      userCount: userMap[w.id] ?? 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users
router.get("/users", async (_req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isAdmin: users.isAdmin,
      workspaceId: users.currentWorkspaceId,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(200);

    // Enrich with workspace name
    const wsIds = [...new Set(allUsers.map(u => u.workspaceId).filter(Boolean))] as string[];
    const wsRows = wsIds.length > 0
      ? await db.select({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan })
          .from(workspaces).where(sql`id = ANY(${wsIds})`)
      : [];
    const wsMap = Object.fromEntries(wsRows.map(w => [w.id, w]));

    res.json(allUsers.map(u => ({
      ...u,
      workspaceName: u.workspaceId ? wsMap[u.workspaceId]?.name ?? null : null,
      workspacePlan: u.workspaceId ? wsMap[u.workspaceId]?.plan ?? null : null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats
router.get("/stats", async (_req, res) => {
  try {
    const [totalUsers, totalWorkspaces, totalJobs, totalContacts, paidWorkspaces, totalCredits, totalRuns, totalOutreach] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(workspaces),
      db.select({ count: sql<number>`count(*)` }).from(jobs),
      db.select({ count: sql<number>`count(*)` }).from(contacts),
      db.select({ count: sql<number>`count(*)` }).from(workspaces).where(ne(workspaces.plan, "free")),
      db.select({ total: sql<string>`coalesce(sum(cast(credits as numeric)), 0)` }).from(workspaces),
      db.select({ count: sql<number>`count(*)` }).from(agentRuns),
      db.select({ count: sql<number>`count(*)` }).from(outreach),
    ]);

    res.json({
      users: Number(totalUsers[0]?.count ?? 0),
      workspaces: Number(totalWorkspaces[0]?.count ?? 0),
      paidWorkspaces: Number(paidWorkspaces[0]?.count ?? 0),
      jobs: Number(totalJobs[0]?.count ?? 0),
      contacts: Number(totalContacts[0]?.count ?? 0),
      totalCredits: Math.round(Number(totalCredits[0]?.total ?? 0)),
      agentRuns: Number(totalRuns[0]?.count ?? 0),
      outreach: Number(totalOutreach[0]?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/workspaces/:id  (unified — accepts credits and/or plan)
router.patch("/workspaces/:id", async (req: AuthRequest, res) => {
  try {
    const updates: any = { updatedAt: new Date() };
    if (req.body.credits !== undefined) updates.credits = req.body.credits.toString();
    if (req.body.plan !== undefined) updates.plan = req.body.plan;
    const [updated] = await db.update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Workspace not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/workspaces/:id/credits  (legacy — kept for backwards compat)
router.patch("/workspaces/:id/credits", async (req: AuthRequest, res) => {
  try {
    const { credits } = req.body;
    const [updated] = await db.update(workspaces)
      .set({ credits: credits.toString(), updatedAt: new Date() })
      .where(eq(workspaces.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/workspaces/:id/plan  (legacy — kept for backwards compat)
router.patch("/workspaces/:id/plan", async (req: AuthRequest, res) => {
  try {
    const { plan } = req.body;
    const [updated] = await db.update(workspaces)
      .set({ plan, updatedAt: new Date() })
      .where(eq(workspaces.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/promote  — toggle admin status
router.patch("/users/:id/promote", async (req: AuthRequest, res) => {
  try {
    const target = await db.query.users.findFirst({ where: eq(users.id, req.params.id) });
    if (!target) return res.status(404).json({ error: "User not found" });
    const [updated] = await db.update(users)
      .set({ isAdmin: !target.isAdmin })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, email: users.email, isAdmin: users.isAdmin });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/workspaces/:id/grant-credits — add credits to workspace
router.post("/workspaces/:id/grant-credits", async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || isNaN(amount)) return res.status(400).json({ error: "Amount required" });
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, req.params.id) });
    if (!ws) return res.status(404).json({ error: "Workspace not found" });
    const newCredits = (parseFloat(ws.credits?.toString() ?? "0") + amount).toString();
    const [updated] = await db.update(workspaces)
      .set({ credits: newCredits, updatedAt: new Date() })
      .where(eq(workspaces.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

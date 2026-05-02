import { Router } from "express";
import { db } from "../db.js";
import { users, workspaces, usageLog, jobs, contacts } from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";
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
    }).from(workspaces).orderBy(desc(workspaces.createdAt)).limit(100);
    res.json(ws);
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
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(100);
    res.json(allUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats
router.get("/stats", async (_req, res) => {
  try {
    const [totalUsers, totalWorkspaces, totalJobs, totalContacts] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(workspaces),
      db.select({ count: sql<number>`count(*)` }).from(jobs),
      db.select({ count: sql<number>`count(*)` }).from(contacts),
    ]);

    res.json({
      users: Number(totalUsers[0]?.count ?? 0),
      workspaces: Number(totalWorkspaces[0]?.count ?? 0),
      jobs: Number(totalJobs[0]?.count ?? 0),
      contacts: Number(totalContacts[0]?.count ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/workspaces/:id/credits
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

// PATCH /api/admin/workspaces/:id/plan
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

export default router;

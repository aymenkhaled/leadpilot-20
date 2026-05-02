import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { contacts, companies } from "@shared/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/contacts
router.get("/", async (req: AuthRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const search = req.query.search as string | undefined;
    const verified = req.query.verified;
    const wid = req.user!.workspaceId;
    const offset = (page - 1) * limit;

    const conditions = [eq(contacts.workspaceId, wid)];
    if (search) conditions.push(ilike(contacts.fullName, `%${search}%`));
    if (verified === "true") conditions.push(eq(contacts.emailVerified, true));

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(contacts).where(where).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(contacts).where(where),
    ]);

    res.json({
      contacts: rows,
      pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, req.params.id), eq(contacts.workspaceId, req.user!.workspaceId)),
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const company = contact.companyId
      ? await db.query.companies.findFirst({ where: eq(companies.id, contact.companyId!) })
      : null;

    res.json({ contact, company });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contacts/:id
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, req.params.id), eq(contacts.workspaceId, req.user!.workspaceId)),
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const [updated] = await db.update(contacts)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(contacts.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/:id/mark-champion
router.post("/:id/mark-champion", async (req: AuthRequest, res) => {
  try {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, req.params.id), eq(contacts.workspaceId, req.user!.workspaceId)),
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const [updated] = await db.update(contacts)
      .set({ isChampion: !contact.isChampion, updatedAt: new Date() })
      .where(eq(contacts.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

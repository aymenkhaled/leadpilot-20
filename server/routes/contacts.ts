import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { contacts, companies } from "@shared/schema";
import { eq, and, desc, asc, ilike, or, sql, inArray } from "drizzle-orm";
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
    if (search) conditions.push(
      or(
        ilike(contacts.fullName, `%${search}%`),
        ilike(contacts.email, `%${search}%`),
        ilike(contacts.title, `%${search}%`)
      )!
    );
    if (verified === "true") conditions.push(eq(contacts.emailVerified, true));
    if (req.query.champion === "true") conditions.push(eq(contacts.isChampion, true));

    const sortParam = req.query.sort as string | undefined;
    const orderBy =
      sortParam === "oldest" ? contacts.createdAt
      : sortParam === "name" ? asc(contacts.fullName)
      : sortParam === "confidence" ? sql`${contacts.emailConfidence} desc nulls last`
      : desc(contacts.createdAt);

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(contacts).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(contacts).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    // Enrich rows with company names
    const companyIds = [...new Set(rows.map(r => r.companyId).filter(Boolean))] as string[];
    const companiesMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const companyRows = await db.select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(inArray(companies.id, companyIds));
      companyRows.forEach(c => { companiesMap[c.id] = c.name; });
    }

    const enrichedRows = rows.map(r => ({
      ...r,
      companyName: r.companyId ? (companiesMap[r.companyId] ?? null) : null,
    }));

    // Total verified count for subtitle (workspace-wide, not just this page)
    const [verifiedResult] = await db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(and(eq(contacts.workspaceId, wid), eq(contacts.emailVerified, true)));

    res.json({
      contacts: enrichedRows,
      verified: Number(verifiedResult?.count ?? 0),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/export/csv  ← MUST be before /:id
router.get("/export/csv", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const { search, verified, champion } = req.query as Record<string, string>;
    const conditions = [eq(contacts.workspaceId, wid)];
    if (search) conditions.push(or(ilike(contacts.fullName, `%${search}%`), ilike(contacts.email, `%${search}%`))!);
    if (verified === "true") conditions.push(eq(contacts.emailVerified, true));
    if (champion === "true") conditions.push(eq(contacts.isChampion, true));
    const rows = await db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.createdAt)).limit(5000);

    const headers = ["Full Name", "Title", "Email", "Email Confidence", "LinkedIn", "Provider", "Is Champion", "Verified", "Created At"];
    const csvRows = rows.map(r => [
      r.fullName || "",
      r.title || "",
      r.email || "",
      r.emailConfidence?.toString() || "",
      r.linkedinUrl || "",
      r.enrichmentProvider || "",
      r.isChampion ? "yes" : "no",
      r.emailVerified ? "yes" : "no",
      r.createdAt?.toISOString() || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="contacts-${Date.now()}.csv"`);
    res.send(csv);
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

// DELETE /api/contacts/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, req.params.id), eq(contacts.workspaceId, req.user!.workspaceId)),
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    await db.delete(contacts).where(eq(contacts.id, req.params.id));
    res.json({ success: true });
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

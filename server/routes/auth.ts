import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { users, workspaces, workspaceMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  signupUser,
  loginUser,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  type AuthRequest,
} from "../auth.js";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const data = signupSchema.parse(req.body);
    const { user, workspace } = await signupUser(
      data.email,
      data.password,
      data.firstName,
      data.lastName
    );

    const token = signToken({ userId: user.id, workspaceId: workspace.id, email: user.email });
    setAuthCookie(res, token);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, plan: workspace.plan },
    });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input", details: err.errors });
    return res.status(400).json({ error: err.message || "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const { user, workspaceId } = await loginUser(data.email, data.password);

    const token = signToken({ userId: user.id, workspaceId, email: user.email });
    setAuthCookie(res, token);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      },
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, slug: workspace.slug, plan: workspace.plan, credits: workspace.credits }
        : null,
    });
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input" });
    return res.status(401).json({ error: err.message || "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.userId),
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, req.user!.workspaceId),
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        avatarUrl: user.avatarUrl,
        currentWorkspaceId: req.user!.workspaceId,
      },
      workspace: workspace
        ? {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
            credits: workspace.credits,
            subscriptionStatus: workspace.subscriptionStatus,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /api/auth/switch-workspace
router.post("/switch-workspace", requireAuth, async (req: AuthRequest, res) => {
  const { workspaceId } = req.body;
  if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

  // Verify user is a member
  const member = await db.query.workspaceMembers.findFirst({
    where: (t) =>
      eq(t.userId, req.user!.userId),
  });

  if (!member) return res.status(403).json({ error: "Not a member of that workspace" });

  const token = signToken({ userId: req.user!.userId, workspaceId, email: req.user!.email });
  setAuthCookie(res, token);

  await db.update(users).set({ currentWorkspaceId: workspaceId }).where(eq(users.id, req.user!.userId));

  res.json({ success: true, workspaceId });
});

export default router;

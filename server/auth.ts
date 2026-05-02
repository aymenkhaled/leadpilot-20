import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { users, workspaces, workspaceMembers, workspaceSettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "leadpilot-dev-secret-change-in-prod";
const JWT_EXPIRES = "7d";
const COOKIE_NAME = "lp_auth";

export interface AuthPayload {
  userId: string;
  workspaceId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = payload;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.userId),
    });
    if (!user?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Helper: ensure every DB query is workspace-scoped
export function withWorkspace(workspaceId: string) {
  return { workspaceId };
}

// Signup
export async function signupUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (existing) throw new Error("Email already in use");

  const passwordHash = await hashPassword(password);
  const slug = `${firstName.toLowerCase()}-${Date.now()}`.replace(/[^a-z0-9-]/g, "-");

  const [workspace] = await db.insert(workspaces).values({
    name: `${firstName}'s Workspace`,
    slug,
    plan: "free",
    credits: "50",
  }).returning();

  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    currentWorkspaceId: workspace.id,
  }).returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  await db.insert(workspaceSettings).values({
    workspaceId: workspace.id,
  });

  return { user, workspace };
}

// Login
export async function loginUser(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!user) throw new Error("Invalid credentials");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  const workspaceId = user.currentWorkspaceId;
  if (!workspaceId) throw new Error("No workspace found");

  return { user, workspaceId };
}

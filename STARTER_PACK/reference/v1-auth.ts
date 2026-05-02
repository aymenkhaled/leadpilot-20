import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; firstName: string; lastName: string };
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  console.warn("Warning: No JWT_SECRET or SESSION_SECRET set. Using development fallback.");
}

const getSecret = () => {
  if (JWT_SECRET) return JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET or SESSION_SECRET must be set in production");
  }
  return "dev-only-fallback-secret-not-for-production";
};

// Auth middleware
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.authToken;
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, getSecret()) as {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
    };
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Generate JWT
export const generateToken = (
  user: { id: number; email: string; firstName: string; lastName: string },
  rememberMe = false
) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    getSecret(),
    { expiresIn: rememberMe ? "30d" : "24h" }
  );
};

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

// Verify password
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

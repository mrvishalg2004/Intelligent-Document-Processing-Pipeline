import session from "express-session";
import type { Express, RequestHandler } from "express";
import MongoStore from "connect-mongo";
import { storage } from "./storage";
import { clientPromise } from "./db";

// Session management setup
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  return session({
    secret: process.env.SESSION_SECRET || 'a-fallback-dev-secret',
    store: MongoStore.create({
      clientPromise,
      ttl: sessionTtl,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// A mock user for local development
const mockUser = {
  _id: "mock-user-id-123",
  email: "dev@example.com",
  firstName: "Mock",
  lastName: "User",
  profileImageUrl: "https://replit.com/public/images/hosting/replit-db.svg",
  claims: {
    sub: "mock-user-id-123",
    email: "dev@example.com",
    first_name: "Mock",
    last_name: "User",
    profile_image_url: "https://replit.com/public/images/hosting/replit-db.svg",
  },
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
};

// This function sets up a mock authentication middleware
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Middleware to create a mock user and session
  app.use(async (req: any, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
    } else {
        await storage.upsertUser({
          _id: mockUser._id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          profileImageUrl: mockUser.profileImageUrl,
        });
        req.user = mockUser;
        req.session.user = mockUser;
    }
    next();
  });

  // Mock routes to replace the original OIDC routes
  app.get("/api/login", (req, res) => res.redirect("/"));
  app.get("/api/callback", (req, res) => res.redirect("/"));
  app.get("/api/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
        if (err) {
            return res.status(500).send("Could not log out.");
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
  });
}

// This middleware checks if a user is "authenticated" in our mock setup
export const isAuthenticated: RequestHandler = (req: any, res, next) => {
  if (req.user) {
    req.user.expires_at = Math.floor(Date.now() / 1000) + 3600; // Refresh expiry
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

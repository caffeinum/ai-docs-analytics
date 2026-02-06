import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  // Extra domains user wants to track (beyond their email domain)
  domains: defineTable({
    userId: v.id("users"),
    host: v.string(),
    verifyToken: v.string(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_host", ["host"]),
});

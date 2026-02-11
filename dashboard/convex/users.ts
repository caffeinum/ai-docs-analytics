import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const ADMIN_EMAILS = ["theisease@gmail.com", "mika.sagindyk@gmail.com"];

// Maps email domains to additional hosts the user should have access to
const EXTRA_DOMAIN_ACCESS: Record<string, string[]> = {
  "opral.com": ["inlang.com"],
  "jamesrichardfry.com": ["clawgles.art", "clawblocks.art"],
};

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const user = await ctx.db.get(userId);
    if (!user) return null;
    
    const emailDomain = user.email?.split("@")[1] || null;
    
    const extraDomains = await ctx.db
      .query("domains")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("verifiedAt"), undefined))
      .collect();
    
    return {
      ...user,
      emailDomain,
      verifiedDomains: extraDomains.map((d) => d.host),
      isAdmin: ADMIN_EMAILS.includes(user.email ?? ""),
    };
  },
});

export const getAllowedHosts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    const user = await ctx.db.get(userId);
    if (!user) return [];

    if (ADMIN_EMAILS.includes(user.email ?? "")) {
      return [];
    }
    
    const emailDomain = user.email?.split("@")[1];
    const hosts: string[] = [];

    if (emailDomain) {
      hosts.push(emailDomain);
      hosts.push(...(EXTRA_DOMAIN_ACCESS[emailDomain] ?? []));
    }

    const extraDomains = await ctx.db
      .query("domains")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("verifiedAt"), undefined))
      .collect();

    hosts.push(...extraDomains.map((d) => d.host));

    return hosts;
  },
});

export const internal_getAllowedHosts = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    if (ADMIN_EMAILS.includes(user.email ?? "")) {
      return [];
    }

    const emailDomain = user.email?.split("@")[1];
    const hosts: string[] = [];

    if (emailDomain) {
      hosts.push(emailDomain);
      hosts.push(...(EXTRA_DOMAIN_ACCESS[emailDomain] ?? []));
    }

    const extraDomains = await ctx.db
      .query("domains")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("verifiedAt"), undefined))
      .collect();

    hosts.push(...extraDomains.map((d) => d.host));

    return hosts;
  },
});

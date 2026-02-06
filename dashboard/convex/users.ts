import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    
    const emailDomain = user.email?.split("@")[1];
    const hosts: string[] = [];
    
    if (emailDomain) {
      hosts.push(emailDomain);
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

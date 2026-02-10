"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAction, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { SignIn } from "./SignIn";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { z } from "zod";

const SiteRowSchema = z.object({
  host: z.string(),
  category: z.string(),
  visits: z.coerce.number(),
});

const AgentSchema = z.object({
  agent: z.string(),
  visits: z.coerce.number(),
});

const PageSchema = z.object({
  host: z.string(),
  path: z.string(),
  agent: z.string(),
  visits: z.coerce.number(),
});

const FeedItemSchema = z.object({
  timestamp: z.string(),
  host: z.string(),
  path: z.string(),
  category: z.string(),
  agent: z.string(),
});

type AgentData = z.infer<typeof AgentSchema>;
type PageData = z.infer<typeof PageSchema>;
type FeedItem = z.infer<typeof FeedItemSchema>;

interface SiteData {
  host: string;
  ai_visits: number;
  human_visits: number;
  ai_percentage: number;
}

const COLORS = [
  "#f5f0e8",
  "#a8a49c",
  "#d4cfc5",
  "#8a857d",
  "#c7c1b6",
  "#6d6962",
];

const TEST_HOSTS = ["localhost", "test.com", "example.com"];

function isTestHost(host: string): boolean {
  return TEST_HOSTS.some(
    (t) => host === t || host.startsWith(`${t}:`) || host.endsWith(`.${t}`)
  );
}

function getRootDomain(host: string): string {
  const withoutPort = host.split(":")[0];
  const parts = withoutPort.split(".");
  if (parts.length <= 2) return withoutPort;
  return parts.slice(-2).join(".");
}

interface DomainGroup {
  root: string;
  hosts: string[];
  totalAI: number;
}

export default function Dashboard() {
  const user = useQuery(api.users.currentUser);
  const allowedHosts = useQuery(api.users.getAllowedHosts);
  const queryAnalytics = useAction(api.analytics.query);
  const { signOut } = useAuthActions();

  const [allSites, setAllSites] = useState<SiteData[]>([]);
  const [allSites24h, setAllSites24h] = useState<SiteData[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [sites, setSites] = useState<SiteData[]>([]);
  const [sites24h, setSites24h] = useState<SiteData[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const domainGroups = useMemo(() => {
    const groups = new Map<string, DomainGroup>();
    for (const site of allSites) {
      if (isTestHost(site.host)) continue;
      const root = getRootDomain(site.host);
      const existing = groups.get(root) || { root, hosts: [], totalAI: 0 };
      existing.hosts.push(site.host);
      existing.totalAI += site.ai_visits;
      groups.set(root, existing);
    }
    return Array.from(groups.values()).sort((a, b) => b.totalAI - a.totalAI);
  }, [allSites]);

  const loadData = useCallback(
    async (rootDomain: string) => {
      const group = domainGroups.find((g) => g.root === rootDomain);
      const hostsInGroup = group?.hosts ?? [];
      const isSingleHost = hostsInGroup.length === 1;
      const apiHost = isSingleHost ? hostsInGroup[0] : undefined;
      const matchesRoot = (h: string) => hostsInGroup.includes(h);

      const [agentsResult, pagesResult, feedResult] = await Promise.all([
        queryAnalytics({ queryName: "agents", host: apiHost }),
        queryAnalytics({ queryName: "pages", host: apiHost }),
        queryAnalytics({ queryName: "feed", host: apiHost }),
      ]);

      const agentsData = z.array(AgentSchema).parse(agentsResult?.data ?? []);
      let pagesData = z.array(PageSchema).parse(pagesResult?.data ?? []);
      let feedData = z.array(FeedItemSchema).parse(feedResult?.data ?? []);

      if (rootDomain) {
        if (!isSingleHost) {
          pagesData = pagesData.filter((p) => matchesRoot(p.host));
          feedData = feedData.filter((f) => matchesRoot(f.host));
        }
        setSites(allSites.filter((s) => matchesRoot(s.host)));
        setSites24h(allSites24h.filter((s) => matchesRoot(s.host)));
      } else {
        setSites(allSites);
        setSites24h(allSites24h);
      }

      setAgents(agentsData);
      setPages(pagesData);
      setFeed(feedData);
      setSwitching(false);
    },
    [allSites, allSites24h, domainGroups, queryAnalytics]
  );

  useEffect(() => {
    if (!user) {
      setAllSites([]);
      setSites([]);
      setAgents([]);
      setPages([]);
      setFeed([]);
      setLoading(true);
      return;
    }
    if (user === undefined || allowedHosts === undefined) return;

    function parseSites(
      rawData: unknown[],
      admin: boolean,
      hosts: string[] | undefined,
    ): SiteData[] {
      const rows = z.array(SiteRowSchema).parse(rawData);
      const siteMap = new Map<string, { ai: number; human: number }>();

      for (const row of rows) {
        const isAllowed =
          admin || !hosts?.length || hosts.some((h) => row.host.includes(h));
        if (!isAllowed) continue;

        const existing = siteMap.get(row.host) || { ai: 0, human: 0 };
        if (row.category === "coding-agent") {
          existing.ai = row.visits;
        } else if (row.category === "human") {
          existing.human = row.visits;
        }
        siteMap.set(row.host, existing);
      }

      const formatted: SiteData[] = Array.from(siteMap.entries()).map(
        ([host, data]) => ({
          host,
          ai_visits: data.ai,
          human_visits: data.human,
          ai_percentage:
            Math.round((data.ai / (data.ai + data.human)) * 100) || 0,
        })
      );
      formatted.sort((a, b) => b.ai_visits - a.ai_visits);
      return formatted;
    }

    async function init() {
      const [sitesResult, sites24hResult] = await Promise.all([
        queryAnalytics({ queryName: "sites" }),
        queryAnalytics({ queryName: "sites-24h" }),
      ]);

      const isAdmin = user?.isAdmin ?? false;

      const formatted7d = parseSites(
        sitesResult?.data ?? [],
        isAdmin,
        allowedHosts,
      );
      const formatted24h = parseSites(
        sites24hResult?.data ?? [],
        isAdmin,
        allowedHosts,
      );

      setAllSites(formatted7d);
      setSites(formatted7d);
      setAllSites24h(formatted24h);
      setSites24h(formatted24h);
      setLoading(false);
    }
    init();
  }, [user, allowedHosts, queryAnalytics]);

  useEffect(() => {
    if (!user || allSites.length === 0) return;
    loadData(selectedHost);
    const interval = setInterval(() => loadData(selectedHost), 10000);
    return () => clearInterval(interval);
  }, [user, selectedHost, allSites, loadData]);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ color: 'var(--cream-dim)' }}>loading...</div>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ color: 'var(--cream-dim)' }}>loading analytics...</div>
      </div>
    );
  }

  const totalAI_7d = sites.reduce((sum, s) => sum + s.ai_visits, 0);
  const totalHuman_7d = sites.reduce((sum, s) => sum + s.human_visits, 0);
  const totalAI_24h = sites24h.reduce((sum, s) => sum + s.ai_visits, 0);
  const totalHuman_24h = sites24h.reduce((sum, s) => sum + s.human_visits, 0);
  const aiPct_7d = totalAI_7d + totalHuman_7d > 0
    ? Math.round((totalAI_7d / (totalAI_7d + totalHuman_7d)) * 100)
    : 0;
  const aiPct_24h = totalAI_24h + totalHuman_24h > 0
    ? Math.round((totalAI_24h / (totalAI_24h + totalHuman_24h)) * 100)
    : 0;
  const has7dData = totalAI_7d !== totalAI_24h || totalHuman_7d !== totalHuman_24h;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-medium" style={{ color: 'var(--cream)' }}>
          AI Docs Analytics
        </h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedHost}
            onChange={(e) => { setSwitching(true); setSelectedHost(e.target.value); }}
            className="select-2027 rounded-lg px-4 py-2"
          >
            <option value="">All Sites</option>
            {domainGroups.map((g) => (
              <option key={g.root} value={g.root}>
                {g.root}{g.hosts.length > 1 ? ` (${g.hosts.length})` : ""}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 text-sm">
            <span style={{ color: 'var(--cream-dim)' }}>{user.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="hover:opacity-80 transition-opacity"
              style={{ color: 'var(--cream-dark)' }}
            >
              sign out
            </button>
          </div>
        </div>
      </div>

      {user?.isAdmin ? (
        <div className="mb-4 text-sm" style={{ color: 'var(--cream-dark)' }}>
          admin — showing all sites
        </div>
      ) : allowedHosts && allowedHosts.length > 0 ? (
        <div className="mb-4 text-sm" style={{ color: 'var(--cream-dark)' }}>
          showing data for: {allowedHosts.join(", ")}
        </div>
      ) : null}

      <div className="relative">
        {switching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}>
            <div style={{ color: 'var(--cream-dim)' }}>loading...</div>
          </div>
        )}
        <div style={{ transition: 'filter 0.2s ease', filter: switching ? 'blur(2px)' : 'none' }}>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="card-2027 rounded-lg p-6">
          <div className="label-style mb-2">AI Visits · 24h</div>
          <div className="text-4xl font-medium" style={{ color: 'var(--cream)' }}>
            {totalAI_24h.toLocaleString()}
          </div>
        </div>
        <div className="card-2027 rounded-lg p-6">
          <div className="label-style mb-2">Human Visits · 24h</div>
          <div className="text-4xl font-medium" style={{ color: 'var(--cream-dim)' }}>
            {totalHuman_24h.toLocaleString()}
          </div>
        </div>
        <div className="card-2027 rounded-lg p-6">
          <div className="label-style mb-2">AI % · 24h</div>
          <div className="text-4xl font-medium" style={{ color: 'var(--cream)' }}>
            {aiPct_24h}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card-2027 rounded-lg p-6">
          <div className="label-style mb-2">AI Visits · 7d</div>
          <div className="text-4xl font-medium" style={{ color: 'var(--cream)' }}>
            {has7dData ? totalAI_7d.toLocaleString() : "n/a"}
          </div>
        </div>
        <div className="card-2027 rounded-lg p-6">
          <div className="label-style mb-2">Human Visits · 7d</div>
          <div className="text-4xl font-medium" style={{ color: 'var(--cream-dim)' }}>
            {has7dData ? totalHuman_7d.toLocaleString() : "n/a"}
          </div>
        </div>
        <div className="card-2027 rounded-lg p-6">
          <div className="label-style mb-2">AI % · 7d</div>
          <div className="text-4xl font-medium" style={{ color: 'var(--cream)' }}>
            {has7dData ? `${aiPct_7d}%` : "n/a"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card-2027 rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4" style={{ color: 'var(--cream)' }}>
            Visits by Site
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sites}>
              <XAxis 
                dataKey="host" 
                tick={{ fill: '#a8a49c', fontSize: 12 }} 
                axisLine={{ stroke: '#3d3b37' }}
                tickLine={{ stroke: '#3d3b37' }}
              />
              <YAxis 
                tick={{ fill: '#a8a49c' }} 
                axisLine={{ stroke: '#3d3b37' }}
                tickLine={{ stroke: '#3d3b37' }}
              />
              <Tooltip
                contentStyle={{ 
                  background: '#0a0a09', 
                  border: '1px solid #3d3b37',
                  borderRadius: '8px',
                  color: '#f5f0e8'
                }}
                itemStyle={{ color: '#f5f0e8' }}
                labelStyle={{ color: '#f5f0e8' }}
              />
              <Bar dataKey="ai_visits" fill="#f5f0e8" name="AI" radius={[4, 4, 0, 0]} />
              <Bar dataKey="human_visits" fill="#3d3b37" name="Human" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-2027 rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4" style={{ color: 'var(--cream)' }}>
            Agent Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={agents}
                dataKey="visits"
                nameKey="agent"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ agent }) => agent}
                labelLine={{ stroke: '#a8a49c' }}
              >
                {agents.map((a, i) => (
                  <Cell key={a.agent} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ 
                  background: '#0a0a09', 
                  border: '1px solid #3d3b37',
                  borderRadius: '8px',
                  color: '#f5f0e8'
                }}
                itemStyle={{ color: '#f5f0e8' }}
                labelStyle={{ color: '#f5f0e8' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card-2027 rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4" style={{ color: 'var(--cream)' }}>
            Top Pages
          </h2>
          <div className="space-y-2">
            {pages.map((p) => (
              <div
                key={`${p.host}${p.path}`}
                className="flex justify-between items-center py-2"
                style={{ borderBottom: '1px solid var(--cream-dark)' }}
              >
                <span 
                  className="truncate max-w-xs" 
                  style={{ color: 'var(--cream-dim)' }}
                >
                  {p.path}
                </span>
                <span 
                  className="font-mono" 
                  style={{ color: 'var(--cream)' }}
                >
                  {p.visits}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-2027 rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4" style={{ color: 'var(--cream)' }}>
            Realtime Feed
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {feed.map((f) => (
              <div
                key={`${f.timestamp}${f.path}`}
                className="flex justify-between items-center py-2 text-sm"
                style={{ borderBottom: '1px solid var(--cream-dark)' }}
              >
                <div>
                  <span 
                    className="font-mono mr-2" 
                    style={{ color: 'var(--cream)' }}
                  >
                    {f.agent}
                  </span>
                  <span 
                    className="truncate" 
                    style={{ color: 'var(--cream-dim)' }}
                  >
                    {f.path}
                  </span>
                </div>
                <span 
                  className="text-xs" 
                  style={{ color: 'var(--cream-dark)' }}
                >
                  {new Date(f.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "convex/react";
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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://ai-docs-analytics-api.theisease.workers.dev";

interface SiteData {
  host: string;
  ai_visits: number;
  human_visits: number;
  ai_percentage: number;
}

interface AgentData {
  agent: string;
  visits: number;
}

interface PageData {
  host: string;
  path: string;
  agent: string;
  visits: number;
}

interface FeedItem {
  timestamp: string;
  host: string;
  path: string;
  category: string;
  agent: string;
}

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#6366f1",
];

async function queryAnalytics<T>(
  queryName: string,
  host?: string
): Promise<T[]> {
  const url = new URL(`${API_URL}/query`);
  url.searchParams.set("q", queryName);
  if (host) url.searchParams.set("host", host);
  const res = await fetch(url.toString());
  const json = await res.json();
  return json.data || [];
}

export default function Dashboard() {
  const user = useQuery(api.users.currentUser);
  const allowedHosts = useQuery(api.users.getAllowedHosts);
  const { signOut } = useAuthActions();

  const [allSites, setAllSites] = useState<SiteData[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [sites, setSites] = useState<SiteData[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(
    async (host: string) => {
      const [agentsData, pagesData, feedData] = await Promise.all([
        queryAnalytics<AgentData>("agents", host || undefined),
        queryAnalytics<PageData>("pages", host || undefined),
        queryAnalytics<FeedItem>("feed", host || undefined),
      ]);
      setAgents(agentsData);
      setPages(pagesData);
      setFeed(feedData);
      if (host) {
        setSites(allSites.filter((s) => s.host === host));
      } else {
        setSites(allSites);
      }
    },
    [allSites]
  );

  useEffect(() => {
    if (user === undefined || allowedHosts === undefined) return;
    if (!user) return;

    async function init() {
      const sitesData = await queryAnalytics<{
        host: string;
        category: string;
        visits: string;
      }>("sites");

      const siteMap = new Map<string, { ai: number; human: number }>();
      for (const row of sitesData) {
        const isAllowed =
          !allowedHosts?.length ||
          allowedHosts.some((h) => row.host.includes(h));
        if (!isAllowed) continue;

        const existing = siteMap.get(row.host) || { ai: 0, human: 0 };
        if (row.category === "coding-agent") {
          existing.ai = Number(row.visits);
        } else if (row.category === "human") {
          existing.human = Number(row.visits);
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
      setAllSites(formatted);
      setSites(formatted);
      setLoading(false);
    }
    init();
  }, [user, allowedHosts]);

  useEffect(() => {
    if (allSites.length === 0) return;
    loadData(selectedHost);
    const interval = setInterval(() => loadData(selectedHost), 10000);
    return () => clearInterval(interval);
  }, [selectedHost, allSites, loadData]);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400">loading...</div>
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400">loading analytics...</div>
      </div>
    );
  }

  const totalAI = sites.reduce((sum, s) => sum + s.ai_visits, 0);
  const totalHuman = sites.reduce((sum, s) => sum + s.human_visits, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">AI Docs Analytics</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedHost}
            onChange={(e) => setSelectedHost(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sites</option>
            {allSites.map((s) => (
              <option key={s.host} value={s.host}>
                {s.host}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>{user.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-zinc-500 hover:text-zinc-300"
            >
              sign out
            </button>
          </div>
        </div>
      </div>

      {allowedHosts && allowedHosts.length > 0 && (
        <div className="mb-4 text-sm text-zinc-500">
          showing data for: {allowedHosts.join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 rounded-lg p-6">
          <div className="text-zinc-400 text-sm">Total AI Visits</div>
          <div className="text-4xl font-bold text-blue-500">{totalAI}</div>
        </div>
        <div className="bg-zinc-900 rounded-lg p-6">
          <div className="text-zinc-400 text-sm">Total Human Visits</div>
          <div className="text-4xl font-bold text-zinc-300">{totalHuman}</div>
        </div>
        <div className="bg-zinc-900 rounded-lg p-6">
          <div className="text-zinc-400 text-sm">AI Percentage</div>
          <div className="text-4xl font-bold text-purple-500">
            {totalAI + totalHuman > 0
              ? Math.round((totalAI / (totalAI + totalHuman)) * 100)
              : 0}
            %
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Visits by Site</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sites}>
              <XAxis dataKey="host" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a1a1aa" }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "none" }}
              />
              <Bar dataKey="ai_visits" fill="#3b82f6" name="AI" />
              <Bar dataKey="human_visits" fill="#71717a" name="Human" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Agent Breakdown</h2>
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
              >
                {agents.map((a, i) => (
                  <Cell key={a.agent} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#18181b", border: "none" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Top Pages</h2>
          <div className="space-y-2">
            {pages.map((p) => (
              <div
                key={`${p.host}${p.path}`}
                className="flex justify-between items-center py-2 border-b border-zinc-800"
              >
                <span className="text-zinc-300 truncate max-w-xs">{p.path}</span>
                <span className="text-blue-500 font-mono">{p.visits}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Realtime Feed</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {feed.map((f) => (
              <div
                key={`${f.timestamp}${f.path}`}
                className="flex justify-between items-center py-2 border-b border-zinc-800 text-sm"
              >
                <div>
                  <span className="text-purple-400 font-mono mr-2">
                    {f.agent}
                  </span>
                  <span className="text-zinc-400 truncate">{f.path}</span>
                </div>
                <span className="text-zinc-500 text-xs">
                  {new Date(f.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

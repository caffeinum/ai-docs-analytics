export const QUERIES: Record<string, string> = {
  default: `
    SELECT blob1 as host, blob3 as category, blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0
    GROUP BY host, category, agent
    ORDER BY visits DESC
    LIMIT 100
  `,
  sites: `
    SELECT blob1 as host, blob3 as category, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0
    GROUP BY host, category
    ORDER BY visits DESC
  `,
  agents: `
    SELECT blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0 AND blob3 = 'coding-agent'
    GROUP BY agent
    ORDER BY visits DESC
  `,
  "all-agents": `
    SELECT blob3 as category, blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND double1 = 0
    GROUP BY category, agent
    ORDER BY visits DESC
  `,
  pages: `
    SELECT blob1 as host, blob2 as path, blob4 as agent, SUM(_sample_interval) as visits
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob3 = 'coding-agent' AND double1 = 0
    GROUP BY host, path, agent
    ORDER BY visits DESC
    LIMIT 50
  `,
  feed: `
    SELECT timestamp, blob1 as host, blob2 as path, blob3 as category, blob4 as agent
    FROM ai_docs_visits
    WHERE timestamp > NOW() - INTERVAL '1' DAY AND double1 = 0
    ORDER BY timestamp DESC
    LIMIT 50
  `,
  raw: `
    SELECT timestamp, index1 as event_id, blob1 as host, blob2 as path, blob3 as user_agent, blob4 as accept_header
    FROM ai_docs_raw_events
    WHERE timestamp > NOW() - INTERVAL '1' DAY
    ORDER BY timestamp DESC
    LIMIT 100
  `,
  debug: `
    SELECT 
      r.timestamp,
      r.index1 as event_id,
      r.blob1 as host,
      r.blob2 as path,
      r.blob3 as user_agent,
      r.blob4 as accept_header,
      v.blob3 as category,
      v.blob4 as agent
    FROM ai_docs_raw_events r
    JOIN ai_docs_visits v ON r.index1 = v.index1
    WHERE r.timestamp > NOW() - INTERVAL '1' DAY
    ORDER BY r.timestamp DESC
    LIMIT 50
  `,
};

export async function runQuery(
  accountId: string,
  apiToken: string,
  queryName: string,
  host?: string
): Promise<{ data?: unknown; error?: string }> {
  const baseSql = QUERIES[queryName];
  if (!baseSql) {
    return { error: `invalid query, allowed: ${Object.keys(QUERIES).join(", ")}` };
  }

  let sql = baseSql;
  if (host) {
    sql = sql.replace("WHERE ", `WHERE blob1 = '${host.replace(/'/g, "''")}' AND `);
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "text/plain",
      },
      body: sql,
    }
  );

  return response.json();
}

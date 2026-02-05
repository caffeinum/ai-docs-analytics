export interface AnalyticsEngineDataset {
  writeDataPoint(data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

export interface Env {
  RAW_EVENTS: AnalyticsEngineDataset;
  VISITS: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

// RAW_EVENTS schema (immutable):
// index1: event_id
// blob1: host, blob2: path, blob3: user_agent, blob4: accept_header, blob5: country

// VISITS schema (processed):
// index1: event_id
// blob1: host, blob2: path, blob3: category, blob4: agent, blob5: country
// double1: is_filtered

export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function writeRawEvent(
  dataset: AnalyticsEngineDataset,
  eventId: string,
  host: string,
  path: string,
  userAgent: string,
  acceptHeader: string,
  country: string
) {
  dataset.writeDataPoint({
    blobs: [host, path, userAgent.slice(0, 500), acceptHeader.slice(0, 500), country],
    indexes: [eventId],
  });
}

export function writeVisit(
  dataset: AnalyticsEngineDataset,
  eventId: string,
  host: string,
  path: string,
  category: string,
  agent: string,
  country: string,
  filtered: boolean
) {
  dataset.writeDataPoint({
    blobs: [host, path, category, agent, country],
    doubles: [filtered ? 1 : 0],
    indexes: [eventId],
  });
}

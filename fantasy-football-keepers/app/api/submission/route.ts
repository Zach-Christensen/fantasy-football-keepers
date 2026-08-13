import { NextRequest } from "next/server";
import { rosters, TeamName } from "@/lib/rosters";

const DATA_SOURCE_ID = "1e84f325-7453-43c1-a74f-2bbeb1b0be48";
const NOTION_VERSION = "2026-03-11";
const MAX_POINTS = 8;
const MAX_KEEPERS = 3;

function headers() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not configured.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function getTeamPins(): Record<string, string> {
  const raw = process.env.TEAM_PINS_JSON;
  if (!raw) throw new Error("TEAM_PINS_JSON is not configured.");

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error();
    return parsed as Record<string, string>;
  } catch {
    throw new Error("TEAM_PINS_JSON must be valid JSON.");
  }
}

function validTeamPin(team: string, pin: unknown) {
  const expected = getTeamPins()[team];
  if (!expected) return false;
  return expected === String(pin ?? "").trim();
}

async function notion(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Notion request failed");
  return data;
}

async function findSubmission(team: string) {
  const data = await notion(`/data_sources/${DATA_SOURCE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "Team", title: { equals: team } },
      page_size: 1,
    }),
  });
  return data.results?.[0] || null;
}

function parseKeepers(page: any): string[] {
  try {
    const text =
      page?.properties?.Keepers?.rich_text?.map((x: any) => x.plain_text).join("") || "[]";
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const team = req.nextUrl.searchParams.get("team") || "";
    if (!(team in rosters)) {
      return Response.json({ error: "Unknown team" }, { status: 400 });
    }

    const page = await findSubmission(team);
    return Response.json({ keepers: page ? parseKeepers(page) : [] });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not load submission" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const team = body.team as TeamName;
    const keepers = Array.isArray(body.keepers)
      ? ([...new Set(body.keepers.filter((x: any) => typeof x === "string"))] as string[])
      : [];

    if (!(team in rosters)) {
      return Response.json({ error: "Unknown team" }, { status: 400 });
    }

    if (!validTeamPin(team, body.pin)) {
      return Response.json({ error: "Incorrect team PIN." }, { status: 401 });
    }

    if (keepers.length < 1 || keepers.length > MAX_KEEPERS) {
      return Response.json(
        { error: `Select between 1 and ${MAX_KEEPERS} keepers.` },
        { status: 400 }
      );
    }

    const roster = rosters[team] as readonly { name: string; points: number }[];
    if (keepers.some(k => !roster.some(p => p.name === k))) {
      return Response.json(
        { error: "One or more selected players are not on this roster." },
        { status: 400 }
      );
    }

    const points = roster
      .filter(p => keepers.includes(p.name))
      .reduce((sum, p) => sum + p.points, 0);

    if (points > MAX_POINTS) {
      return Response.json(
        { error: `Keeper total cannot exceed ${MAX_POINTS} points.` },
        { status: 400 }
      );
    }

    const keepersText = JSON.stringify(keepers);
    const now = new Date().toISOString();
    const properties = {
      Team: {
        type: "title",
        title: [{ type: "text", text: { content: team } }],
      },
      Keepers: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: keepersText } }],
      },
      Points: { type: "number", number: points },
      Updated: { type: "date", date: { start: now } },
    };

    const existing = await findSubmission(team);

    if (existing) {
      await notion(`/pages/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });
    } else {
      await notion(`/pages`, {
        method: "POST",
        body: JSON.stringify({
          parent: { type: "data_source_id", data_source_id: DATA_SOURCE_ID },
          properties,
        }),
      });
    }

    return Response.json({ ok: true, keepers, points });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not save submission" },
      { status: 500 }
    );
  }
}

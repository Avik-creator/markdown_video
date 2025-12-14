import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { markdown } = await request.json();

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json({ error: "Markdown is required" }, { status: 400 });
    }

    // Generate a unique project ID
    const projectId = randomBytes(8).toString("base64url");
    const key = `project:${projectId}`;

    // Store in Redis with 7 day expiration
    await redis.set(key, markdown, { ex: 60 * 60 * 24 * 7 });

    return NextResponse.json({ projectId });
  } catch (error) {
    console.error("Error storing project:", error);
    return NextResponse.json({ error: "Failed to store project" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const key = `project:${projectId}`;
    const markdown = await redis.get<string>(key);

    if (!markdown) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error("Error retrieving project:", error);
    return NextResponse.json({ error: "Failed to retrieve project" }, { status: 500 });
  }
}


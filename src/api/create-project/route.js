import catalyst from 'zcatalyst-sdk-node';
import { NextResponse } from 'next/server';

async function handler(req, res) {
  const { website } = await req.json();

  if (!website) {
    return NextResponse.json({ error: "Website URL is required" }, { status: 400 });
  }

  let websiteUrl = website.trim();
  if (!websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
    websiteUrl = "https://" + websiteUrl;
  }

  try {
    new URL(websiteUrl);
  } catch {
    return NextResponse.json({ error: "Invalid website URL format" }, { status: 400 });
  }

  try {
    const app = catalyst.initialize(null, { scope: 'admin' });
    const table = app.datastore().table('projects');
    const result = await table.insertRow({ website: websiteUrl });
    return NextResponse.json({ id: result.ROWID, website: result.website });
  } catch (error) {
    console.error("Project creation error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function POST(req) {
  return handler(req);
}
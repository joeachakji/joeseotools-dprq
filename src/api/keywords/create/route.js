import catalyst from 'zcatalyst-sdk-node';
import { NextResponse } from 'next/server';

async function handler(req) {
  const { keyword, projectId } = await req.json();

  if (!keyword) {
    return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

  try {
    const app = catalyst.initialize(null, { scope: 'admin' });
    const table = app.datastore().table('keywords');
    const result = await table.insertRow({ 
      keyword: keyword, 
      project_id: projectId 
    });
    return NextResponse.json({ id: result.ROWID, keyword: result.keyword, project_id: result.project_id });
  } catch (error) {
    console.error("Error adding keyword:", error);
    return NextResponse.json({ error: "Failed to add keyword" }, { status: 500 });
  }
}

export async function POST(req) {
  return handler(req);
}
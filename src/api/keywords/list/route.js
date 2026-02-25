import catalyst from 'zcatalyst-sdk-node';
import { NextResponse } from 'next/server';

async function handler(req) {
  const { projectId } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

  try {
    const app = catalyst.initialize(req);
    const zcql = app.zcql();

    const keywords = await zcql.executeZCQLQuery(
      `SELECT * FROM keywords WHERE project_id = ${projectId}`
    );

    const keywordsWithRankings = await Promise.all(
      keywords.map(async (k) => {
        const keywordId = k.keywords.ROWID;

        const comRankings = await zcql.executeZCQLQuery(
          `SELECT * FROM keyword_rankings WHERE keyword_id = ${keywordId} AND domain = 'google.com' ORDER BY checked_at DESC LIMIT 1`
        );

        const caRankings = await zcql.executeZCQLQuery(
          `SELECT * FROM keyword_rankings WHERE keyword_id = ${keywordId} AND domain = 'google.ca' ORDER BY checked_at DESC LIMIT 1`
        );

        const comRanking = comRankings[0]?.keyword_rankings;
        const caRanking = caRankings[0]?.keyword_rankings;

        return {
          id: keywordId,
          keyword: k.keywords.keyword,
          project_id: k.keywords.project_id,
          google_com_position: comRanking?.position || null,
          google_com_checked_at: comRanking?.checked_at || null,
          google_ca_position: caRanking?.position || null,
          google_ca_checked_at: caRanking?.checked_at || null,
          last_checked: comRanking?.checked_at || caRanking?.checked_at || null,
        };
      })
    );

    return NextResponse.json(keywordsWithRankings);
  } catch (error) {
    console.error("Error listing keywords:", error);
    return NextResponse.json({ error: "Failed to list keywords" }, { status: 500 });
  }
}

export async function POST(req) {
  return handler(req);
}
import catalyst from 'zcatalyst-sdk-node';
import { NextResponse } from 'next/server';

async function handler(req) {
  const { keywordId, domains = ["google.com", "google.ca"] } = await req.json();

  if (!keywordId) {
    return NextResponse.json({ success: false, error: "Keyword ID is required" }, { status: 400 });
  }

  try {
    const app = catalyst.initialize(null, { scope: 'admin' });
    const zcql = app.zcql();
    const rankingsTable = app.datastore().table('keyword_rankings');
    const keywordsTable = app.datastore().table('keywords');

    const keywordResult = await zcql.executeZCQLQuery(
      `SELECT * FROM keywords WHERE ROWID = ${keywordId}`
    );

    if (!keywordResult.length) {
      return NextResponse.json({ success: false, error: "Keyword not found" }, { status: 404 });
    }

    const keyword = keywordResult[0].keywords;
    const projectResult = await zcql.executeZCQLQuery(
      `SELECT * FROM projects WHERE ROWID = ${keyword.project_id}`
    );

    const website = projectResult[0].projects.website;
    const websiteDomain = website
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "")
      .toLowerCase();

    const checkDomain = async (domain) => {
      try {
        const maxRetries = 3;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const searchUrl = `https://www.${domain}/search?` +
              new URLSearchParams({
                q: keyword.keyword,
                num: "100",
                hl: "en",
                gl: domain === "google.ca" ? "ca" : "us",
                pws: "0",
                safe: "active",
                filter: "0",
              }).toString();

            const response = await fetch("/integrations/web-scraping/post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: searchUrl,
                getText: false,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                timeout: 30000,
              }),
            });

            if (!response.ok) throw new Error(`Search request failed for ${domain}: ${response.status}`);

            const html = await response.text();
            if (html.includes("504 Gateway Time-out")) throw new Error("Gateway timeout");

            let position = null;
            let foundUrl = null;
            let foundTitle = null;

            const results = html.match(/<h3[^>]*>.*?<\/h3>.*?href="(https?:\/\/[^"]+)"/g) || [];

            for (let i = 0; i < results.length; i++) {
              const urlMatch = results[i].match(/href="(https?:\/\/[^"]+)"/);
              if (!urlMatch) continue;
              const url = urlMatch[1];
              if (url.includes("google.com") || url.includes("/search?")) continue;
              const resultDomain = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").toLowerCase();
              if (resultDomain.includes(websiteDomain) || websiteDomain.includes(resultDomain)) {
                position = i + 1;
                foundUrl = url;
                const titleMatch = results[i].match(/<h3[^>]*>(.*?)<\/h3>/);
                foundTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
                break;
              }
            }

            await rankingsTable.insertRow({
              keyword_id: keywordId,
              position: position,
              url: foundUrl,
              title: foundTitle,
              domain: domain,
              checked_at: new Date().toISOString(),
            });

            return { domain, success: true };
          } catch (error) {
            if (attempt < maxRetries - 1) {
              await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              continue;
            }
            throw error;
          }
        }
      } catch (error) {
        console.error(`Error checking ${domain}:`, error);
        await rankingsTable.insertRow({
          keyword_id: keywordId,
          position: null,
          url: null,
          title: null,
          domain: domain,
          checked_at: new Date().toISOString(),
        });
        return { domain, success: false, error: error.message };
      }
    };

    const results = await Promise.all(
      domains.map((domain, index) =>
        new Promise((resolve) => setTimeout(() => resolve(checkDomain(domain)), index * 2000))
      )
    );

    const failures = results.filter((r) => !r.success);
    if (failures.length === domains.length) {
      return NextResponse.json({ success: false, error: "All domain checks failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Overall ranking check error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  return handler(req);
}
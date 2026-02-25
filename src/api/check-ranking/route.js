async function handler({ keywordId, domains = ["google.com", "google.ca"] }) {
  if (!keywordId) {
    return { success: false, error: "Keyword ID is required" };
  }

  try {
    const keywordResult = await sql`
      SELECT k.*, p.website 
      FROM keywords k
      JOIN projects p ON k.project_id = p.id 
      WHERE k.id = ${keywordId}
    `;

    if (!keywordResult.length) {
      return { success: false, error: "Keyword not found in database" };
    }

    const keyword = keywordResult[0];
    const website = keyword.website;
    const websiteDomain = website
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "")
      .toLowerCase();

    await sql`
      UPDATE keywords 
      SET last_checked = CURRENT_TIMESTAMP 
      WHERE id = ${keywordId}
    `;

    const checkDomain = async (domain) => {
      try {
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const searchUrl =
              `https://www.${domain}/search?` +
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
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                  Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                timeout: 30000,
              }),
            });

            if (!response.ok) {
              throw new Error(
                `Search request failed for ${domain}: ${response.status}`
              );
            }

            const html = await response.text();

            if (html.includes("504 Gateway Time-out")) {
              throw new Error("Gateway timeout");
            }

            let position = null;
            let foundUrl = null;
            let foundTitle = null;

            const results =
              html.match(/<h3[^>]*>.*?<\/h3>.*?href="(https?:\/\/[^"]+)"/g) ||
              [];

            for (let i = 0; i < results.length; i++) {
              const urlMatch = results[i].match(/href="(https?:\/\/[^"]+)"/);
              if (!urlMatch) continue;

              const url = urlMatch[1];
              if (url.includes("google.com") || url.includes("/search?"))
                continue;

              const resultDomain = url
                .replace(/^https?:\/\/(www\.)?/, "")
                .replace(/\/.*$/, "")
                .toLowerCase();

              if (
                resultDomain.includes(websiteDomain) ||
                websiteDomain.includes(resultDomain)
              ) {
                position = i + 1;
                foundUrl = url;
                const titleMatch = results[i].match(/<h3[^>]*>(.*?)<\/h3>/);
                foundTitle = titleMatch
                  ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
                  : "";
                break;
              }
            }

            await sql`
              INSERT INTO keyword_rankings 
              (keyword_id, position, url, title, domain, checked_at)
              VALUES 
              (${keywordId}, ${position}, ${foundUrl}, ${foundTitle}, ${domain}, CURRENT_TIMESTAMP)
            `;

            return { domain, success: true };
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 1000)
              );
              continue;
            }
            throw error;
          }
        }
      } catch (error) {
        console.error(`Error checking ${domain}:`, error);
        await sql`
          INSERT INTO keyword_rankings 
          (keyword_id, position, url, title, domain, checked_at)
          VALUES 
          (${keywordId}, null, null, null, ${domain}, CURRENT_TIMESTAMP)
        `;
        return { domain, success: false, error: error.message };
      }
    };

    const results = await Promise.all(
      domains.map(
        (domain, index) =>
          new Promise((resolve) =>
            setTimeout(() => resolve(checkDomain(domain)), index * 2000)
          )
      )
    );

    const failures = results.filter((r) => !r.success);
    if (failures.length === domains.length) {
      return { success: false, error: "All domain checks failed" };
    }

    return { success: true };
  } catch (error) {
    console.error("Overall ranking check error:", error);
    return { success: false, error: error.message };
  }
}
export async function POST(request) {
  return handler(await request.json());
}
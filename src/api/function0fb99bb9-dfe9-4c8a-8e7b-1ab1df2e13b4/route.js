async function handler({ keywordId, domains = ["google.com", "google.ca"] }) {
  console.log("Starting ranking check for keyword ID:", keywordId);
  console.log("Domains to check:", domains);

  if (!keywordId) {
    console.log("Error: No keyword ID provided");
    return {
      success: false,
      error: "Keyword ID is required",
      progress: 0,
    };
  }

  if (!domains || domains.length === 0) {
    console.log("Error: No domains provided");
    return {
      success: false,
      error: "At least one domain must be selected",
      progress: 0,
    };
  }

  try {
    console.log("Fetching keyword and website information...");
    const keywords = await sql`
      SELECT k.*, p.website 
      FROM keywords k
      JOIN projects p ON k.project_id = p.id 
      WHERE k.id = ${keywordId}
    `;
    console.log("SQL query result:", keywords);

    if (!keywords.length) {
      console.log("Error: Keyword not found in database");
      return {
        success: false,
        error: "Keyword not found",
        progress: 0,
      };
    }

    const keyword = keywords[0];
    const website = keyword.website;
    console.log("Keyword:", keyword.keyword);
    console.log("Website:", website);

    if (!website) {
      console.log("Error: No website found for this keyword");
      return {
        success: false,
        error: "Website is required to check rankings",
        progress: 0,
      };
    }

    const websiteDomain = website
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "")
      .toLowerCase();
    console.log("Website domain for matching:", websiteDomain);

    let progress = 0;
    const progressPerDomain = 100 / domains.length;

    for (const domain of domains) {
      try {
        console.log(`\nChecking domain: ${domain}`);
        if (domain !== domains[0]) {
          console.log("Waiting 2 seconds before next request...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        progress = Math.floor(
          domains.indexOf(domain) * progressPerDomain + progressPerDomain / 2
        );

        const searchUrl = `https://www.${domain}/search?q=${encodeURIComponent(
          keyword.keyword
        )}&hl=en&num=100`;
        console.log("Search URL:", searchUrl);

        console.log("Making web scraping request...");
        const response = await fetch("/integrations/web-scraping/post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: searchUrl,
            getText: false,
          }),
        });

        if (!response.ok) {
          console.log(
            "Web scraping request failed:",
            response.status,
            response.statusText
          );
          throw new Error(`Failed to fetch search results from ${domain}`);
        }

        const html = await response.text();
        console.log("Received HTML length:", html.length);

        console.log("Parsing search results...");
        const mainContentRegex = /<div class="v7W49e">.*?<\/div>/gs;
        const mainContent = html.match(mainContentRegex);

        if (!mainContent) {
          console.warn(`No main content found for ${domain}`);
          continue;
        }

        const resultRegex = /<div class="MjjYud">.*?<\/div>/gs;
        const results = [];
        let match;

        while ((match = resultRegex.exec(mainContent[0])) !== null) {
          results.push(match[0]);
        }
        console.log("Found search results:", results.length);

        let position = null;
        let foundUrl = null;
        let foundTitle = null;

        for (let i = 0; i < results.length; i++) {
          const urlMatch = results[i].match(/href="(https?:\/\/[^"]+)"/);
          const titleMatch = results[i].match(/<h3[^>]*>(.*?)<\/h3>/);

          if (urlMatch) {
            const resultUrl = urlMatch[1];
            console.log(`\nChecking result #${i + 1}:`);
            console.log("Result URL:", resultUrl);

            const resultDomain = resultUrl
              .replace(/^https?:\/\/(www\.)?/, "")
              .replace(/\/.*$/, "")
              .toLowerCase();
            console.log("Result domain:", resultDomain);
            console.log("Looking for:", websiteDomain);

            if (
              resultDomain.includes(websiteDomain) ||
              websiteDomain.includes(resultDomain)
            ) {
              position = i + 1;
              foundUrl = resultUrl;
              foundTitle = titleMatch
                ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
                : "";
              console.log("Found match at position:", position);
              console.log("Title:", foundTitle);
              break;
            }
          }
        }

        console.log("\nStoring ranking result...");
        console.log("Position:", position);
        console.log("URL:", foundUrl);
        console.log("Title:", foundTitle);

        await sql`
          INSERT INTO keyword_rankings 
          (keyword_id, position, url, title, domain)
          VALUES 
          (${keywordId}, ${position}, ${foundUrl}, ${foundTitle}, ${domain})
        `;
        console.log("Ranking stored successfully");

        progress = Math.floor(
          (domains.indexOf(domain) + 1) * progressPerDomain
        );
      } catch (domainError) {
        console.error(`Error checking ${domain}:`, domainError);
        console.error("Stack trace:", domainError.stack);
        throw new Error(
          `Failed to check rankings for ${domain}: ${domainError.message}`
        );
      }
    }

    console.log("Ranking check completed successfully");
    return {
      success: true,
      progress: 100,
    };
  } catch (error) {
    console.error("Ranking check error:", error);
    console.error("Stack trace:", error.stack);
    return {
      success: false,
      error: error.message,
      progress: 0,
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}
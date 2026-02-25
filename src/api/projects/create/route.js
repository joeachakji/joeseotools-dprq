async function handler({ website }) {
  if (!website) {
    return { error: "Website URL is required" };
  }

  let websiteUrl = website.trim();

  if (!websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
    websiteUrl = "https://" + websiteUrl;
  }

  try {
    new URL(websiteUrl);
  } catch {
    return { error: "Invalid website URL format" };
  }

  try {
    const result = await sql`
      INSERT INTO projects (website)
      VALUES (${websiteUrl})
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    console.error("Project creation error:", error);
    return { error: "Failed to create project" };
  }
}
export async function POST(request) {
  return handler(await request.json());
}
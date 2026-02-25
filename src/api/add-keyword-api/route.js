async function handler({ keyword, projectId }) {
  if (!keyword || !keyword.trim()) {
    return { error: "Keyword is required" };
  }

  if (!projectId) {
    return { error: "Project ID is required" };
  }

  try {
    const result = await sql`
      INSERT INTO keywords (keyword, project_id)
      VALUES (${keyword.trim()}, ${projectId})
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    console.error("Error adding keyword:", error);
    return { error: "Failed to add keyword" };
  }
}
export async function POST(request) {
  return handler(await request.json());
}
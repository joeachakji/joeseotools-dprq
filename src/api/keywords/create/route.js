async function handler({ keyword, projectId }) {
  console.log("Adding keyword:", { keyword, projectId });

  if (!keyword) {
    throw new Error("Keyword is required");
  }

  if (!projectId) {
    throw new Error("Project ID is required");
  }

  try {
    const result = await sql`
      INSERT INTO keywords (keyword, project_id)
      VALUES (${keyword}, ${projectId})
      RETURNING *
    `;

    console.log("Added keyword:", result[0]);
    return result[0];
  } catch (error) {
    console.error("Error adding keyword:", error);
    throw new Error("Failed to add keyword");
  }
}
export async function POST(request) {
  return handler(await request.json());
}
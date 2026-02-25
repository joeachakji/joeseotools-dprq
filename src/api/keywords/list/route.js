async function handler({ projectId }) {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  try {
    const keywords = await sql`
      SELECT 
        k.*,
        kr_com.position as google_com_position,
        kr_com.checked_at as google_com_checked_at,
        kr_ca.position as google_ca_position,
        kr_ca.checked_at as google_ca_checked_at,
        GREATEST(COALESCE(kr_com.checked_at, null), 
                COALESCE(kr_ca.checked_at, null)) as last_checked
      FROM keywords k
      LEFT JOIN LATERAL (
        SELECT position, checked_at
        FROM keyword_rankings
        WHERE keyword_id = k.id
        AND domain = 'google.com'
        ORDER BY checked_at DESC
        LIMIT 1
      ) kr_com ON true
      LEFT JOIN LATERAL (
        SELECT position, checked_at
        FROM keyword_rankings
        WHERE keyword_id = k.id
        AND domain = 'google.ca'
        ORDER BY checked_at DESC
        LIMIT 1
      ) kr_ca ON true
      WHERE k.project_id = ${projectId}
      ORDER BY k.created_at DESC
    `;

    return keywords;
  } catch (error) {
    throw new Error("Failed to list keywords");
  }
}
export async function POST(request) {
  return handler(await request.json());
}
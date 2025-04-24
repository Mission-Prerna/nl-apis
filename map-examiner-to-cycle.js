const { Pool } = require("pg");
require("dotenv").config();

// Helper function to get the current timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Ensure PostgreSQL database URI is provided
// const pgDbUri = "postgresql://mpcuplakshyauser:prerakbalakbakshikatalab@128.199.28.17:8015/prerakbalakdb?schema=public"
const pgDbUri = "postgresql://mpcuplakshyauser:prerakbalakbakshikatalab@103.154.251.109:8015/prerakbalakdb?schema=public"

if (!pgDbUri) {
  console.error(`[${getTimestamp()}] PostgreSQL database URI is not provided or empty.`);
  throw new Error("PostgreSQL database URI is not provided or empty.");
}

// PostgreSQL connection pool setup
const pool = new Pool({
  connectionString: pgDbUri,
});

// Hardcoded cycle ID
const CYCLE_ID = 11; // Replace with the actual cycle_id

// Batch size for inserts
const BATCH_SIZE = 5000;

// Function to fetch mentors with actor_id = 2
async function fetchMentors() {
  const client = await pool.connect();
  try {
    console.log(`[${getTimestamp()}] Fetching mentors with actor_id = 2...`);

    const query = `
      SELECT id AS mentor_id, district_id
      FROM mentor
      WHERE actor_id = 2 AND is_active = true;
    `;

    const result = await client.query(query);
    console.log(`[${getTimestamp()}] Found ${result.rowCount} mentors.`);
    return result.rows;
  } catch (error) {
    console.error(`[${getTimestamp()}] Error fetching mentors:`, error.message);
    return [];
  } finally {
    client.release();
  }
}

// Function to insert mentor mappings in batches
async function insertMentorMappings(mentorMappings) {
  if (mentorMappings.length === 0) {
    console.log("No data to insert.");
    return;
  }

  const client = await pool.connect();
  try {
    console.log(`[${getTimestamp()}] Inserting mentor mappings into assessment_cycle_district_mentor_mapping...`);

    let totalInserted = 0;
    for (let i = 0; i < mentorMappings.length; i += BATCH_SIZE) {
      const batch = mentorMappings.slice(i, i + BATCH_SIZE);

      // Construct bulk insert query
      const values = batch.map(m => `(${CYCLE_ID}, ${m.district_id}, ${m.mentor_id})`).join(", ");

      const query = `
        INSERT INTO assessment_cycle_district_mentor_mapping (cycle_id, district_id, mentor_id)
        VALUES ${values}
        ON CONFLICT DO NOTHING;
      `;

      const result = await client.query(query);
      totalInserted += result.rowCount;
      console.log(`[${getTimestamp()}] Inserted batch of ${result.rowCount} records.`);
    }

    console.log(`[${getTimestamp()}] Total inserted records: ${totalInserted}`);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error inserting mentor mappings:`, error.message);
  } finally {
    client.release();
  }
}

// Main function to execute the process
(async () => {
  const mentors = await fetchMentors();
  if (mentors.length > 0) {
    await insertMentorMappings(mentors);
  }
  pool.end();
})();

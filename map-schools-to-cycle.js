const { Client } = require('pg');
const axios = require('axios');

const CYCLE_ID = 11
const API_URL = `https://api.nl.samagra.io/admin/assessment-cycle/${CYCLE_ID}/district-school-mapping?allUdise=false`;
const AUTH_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRwSFNCOUYteGw5OGZLSnJ0LVEyVDV6UjQ3cyJ9.eyJhdWQiOiJjZDA4ZmJlMC1mYmU2LTQzYzktOGQ1Yy01YmJjMzNiYTBkOWMiLCJleHAiOjE3Mzk4MDE5NDIsImlhdCI6MTczOTcxNTU0MiwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyNmFhMDFlNi0wOTg0LTQyZDctYWM2MS1mNmQ1YWI3M2E0MmUiLCJqdGkiOiIzOTU1YTJjYy03YjNiLTQzNmQtYTUxZC01OGQ3Y2EwZTA4OGIiLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6ImNvbnNvbGUtYWRtaW4iLCJhcHBsaWNhdGlvbklkIjoiY2QwOGZiZTAtZmJlNi00M2M5LThkNWMtNWJiYzMzYmEwZDljIiwicm9sZXMiOlsiQWRtaW4iXSwiYXV0aF90aW1lIjoxNzM5NzE1NTQyLCJ0aWQiOiIwMTA1NjZmZC1lMWNiLWM2NTgtYjY1OS1hMWQzZTA3MGJhYTgiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiQWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiQWRtaW4ifX0.x9K44p_rQg9RH23yubLuvy5IG--8S1cLUE1gKHgPNv21HTYcpWmLRfjYX8e-8t_lP2FTaJ8bP8iRQhExz5gIFtuPMRblR1OBghfRWleRSlk8l6EyTTyWfqwNxxK3DMm2c5cxY0gZBk_nBJV-N55uOUe4mh67URJt7VcFCPfrIoNLO8J4IAZrC1B7uvEC53YOyH2lALhYwYTcRuJruz7X30dmjX25gNrOo5N3dzP5C5Rq4_NX1z-06oKS7xYf40sHBXst-iKpHmZHIB9QuHj6R_LVaG9Py42428sYM144xYvaAyv1pXgU7COZAoyUFm5daB0DrJsIdhz47Sue_Bk81w'; // Truncated for security

// PostgreSQL client setup
const client = new Client({
  user: 'mpcuplakshyauser',      // Replace with your DB user
  host: '103.154.251.109',         // Replace with your DB host
  database: 'prerakbalakdb',  // Replace with your DB name
  password: 'prerakbalakbakshikatalab',  // Replace with your DB password
  port: 8015,                // Replace with your DB port (default is 5432)
});

// Max retries and delay for API calls
const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 2000; // 2 seconds

async function fetchSchoolsInChunks() {
  try {
    // Connect to the database
    await client.connect();
    
    // Count total schools
    const countRes = await client.query('SELECT COUNT(*) FROM school_list');
    const totalSchools = parseInt(countRes.rows[0].count, 10);
    
    console.log(`Total Schools: ${totalSchools}`);

    const CHUNK_SIZE = 500;

    for (let offset = 0; offset < totalSchools; offset += CHUNK_SIZE) {
      // Fetch a chunk of schools
      const res = await client.query(`SELECT udise FROM school_list LIMIT ${CHUNK_SIZE} OFFSET ${offset}`);
      const schools = res.rows.map(row => ({ udise: row.udise }));

      console.log(`Processing schools ${offset + 1} - ${offset + schools.length}`);

      // Send chunk to API with retry logic
      await sendToApiWithRetry(schools);
    }

    console.log('✅ All schools processed successfully!');
  } catch (error) {
    console.error('❌ Critical error fetching schools:', error);
  } finally {
    // Close DB connection
    await client.end();
  }
}

// Function to send data with retries
async function sendToApiWithRetry(schools) {
  let attempts = 0;
  let delay = INITIAL_DELAY_MS;

  while (attempts < MAX_RETRIES) {
    try {
      await axios.post(API_URL, schools, {
        headers: {
          'Authorization': AUTH_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Successfully sent ${schools.length} schools.`);
      return; // Success, exit function
    } catch (error) {
      attempts++;
      console.error(`❌ Attempt ${attempts} failed: ${error.message}`);

      if (attempts >= MAX_RETRIES) {
        console.error(`❌ Failed to send schools after ${MAX_RETRIES} attempts. Skipping this batch.`);
        return; // Give up after max retries
      }

      // Exponential backoff (wait longer after each failure)
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Double the wait time
    }
  }
}

// Run the function
fetchSchoolsInChunks();

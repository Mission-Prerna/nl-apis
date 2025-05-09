const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PAGE_SIZE = 100000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

let last_created_at = null;
let last_mentor_id = null;

const params = {
  from_date: '2025-05-01',
  to_date: '2025-05-07',
  actor_type: 'teacher',
};

const OUTPUT_FILE = path.resolve(__dirname, `data/${params.actor_type}-assessment-result.json`);
const STUDENT_IDS_FILE = path.resolve(__dirname, `data/student_ids_from_json.json`);
const DUPLICATE_IDS_FILE = path.resolve(__dirname, `data/duplicate_student_ids.json`);

const BASE_URL = 'http://103.154.251.109:8000/data/student-assessment-data';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRwSFNCOUYteGw5OGZLSnJ0LVEyVDV6UjQ3cyJ9.eyJhdWQiOiJjZDA4ZmJlMC1mYmU2LTQzYzktOGQ1Yy01YmJjMzNiYTBkOWMiLCJleHAiOjE3NDY2ODM1MzUsImlhdCI6MTc0NjU5NzEzNSwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyNmFhMDFlNi0wOTg0LTQyZDctYWM2MS1mNmQ1YWI3M2E0MmUiLCJqdGkiOiJhY2RmZTg5Ni02YTM4LTQ5NGYtODM2ZC03MjNlZGJlODhmNjMiLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6ImNvbnNvbGUtYWRtaW4iLCJhcHBsaWNhdGlvbklkIjoiY2QwOGZiZTAtZmJlNi00M2M5LThkNWMtNWJiYzMzYmEwZDljIiwicm9sZXMiOlsiQWRtaW4iXSwiYXV0aF90aW1lIjoxNzQ2NTk3MTM1LCJ0aWQiOiIwMTA1NjZmZC1lMWNiLWM2NTgtYjY1OS1hMWQzZTA3MGJhYTgiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiQWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiQWRtaW4ifX0.vkXFW6kwpJYeIzBxoWZv0r-0UGiWNuTU3wMi6AlkGPS9ouoKuTyhy9uwMUWg460RxNrveTYXJkBo2Euqu0XW3uA0J9VHyRPra3n1_Ss4QvSTkw-YtqmfLIpEc8s8oxIoTHoNtfREDoJngPUfLxb2syr0QAcbulvpgqv5XSEZ5196kWYRdbJGet7hPijb0Jw1VKrIlpDJOWBlN8_l-bSGzHaC_FjLaTPqoH9yuR1Z4elNO2SsOCbZ4crayeJKMtakOibgYHjveyX7x4yKGmVzF_sj-d4UZ64zY5O3L3ZLz7sq79kKhIghq-EUymBHFd5zYHggBltdPa8aTPekpn7jjA';

// Tracking sets/maps
const uniqueStudentIds = new Set();
const duplicateStudentIds = new Set();
const seenStudentCounts = new Map();

// Convert current time to IST
function getISTTime() {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const istTime = new Date(now.getTime() + istOffset * 60000);
  return istTime.toISOString().replace('T', ' ').split('.')[0] + ' IST';
}

function logProgress(message) {
  console.log(`[${getISTTime()}] ${message}`);
}

function updateStudentTracking(dataChunk) {
  dataChunk.forEach(item => {
    const sid = item?.student?.student_id;
    if (sid) {
      const count = seenStudentCounts.get(sid) || 0;
      seenStudentCounts.set(sid, count + 1);

      if (count >= 1) {
        duplicateStudentIds.add(sid);
      }
      uniqueStudentIds.add(sid);
    }
  });

  // Write to files after each iteration
  fs.writeFileSync(STUDENT_IDS_FILE, JSON.stringify([...uniqueStudentIds], null, 2));
  fs.writeFileSync(DUPLICATE_IDS_FILE, JSON.stringify([...duplicateStudentIds], null, 2));
}

async function fetchWithRetryByCompositeCursor(last_created_at, last_mentor_id, attempt = 1) {
  try {
    const response = await axios.get(BASE_URL, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      params: {
        ...params,
        limit: PAGE_SIZE,
        last_created_at,
        last_mentor_id,
      },
    });
    return response.data;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt;
      logProgress(`Retry ${attempt} after ${delay}ms due to error: ${error.message}`);
      await new Promise((res) => setTimeout(res, delay));
      return fetchWithRetryByCompositeCursor(last_created_at, last_mentor_id, attempt + 1);
    } else {
      throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
    }
  }
}

async function fetchAllData() {
  let totalFetched = 0;
  let isFirstChunk = true;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });
  writeStream.write('[\n');

  while (true) {
    logProgress(`Fetching after last_created_at: ${last_created_at}, last_mentor_id: ${last_mentor_id}`);
    const data = await fetchWithRetryByCompositeCursor(last_created_at, last_mentor_id);

    if (!Array.isArray(data) || data.length === 0) {
      logProgress('No more data. Finished fetching.');
      break;
    }

    for (let i = 0; i < data.length; i++) {
      const line = JSON.stringify(data[i], null, 0);
      writeStream.write((isFirstChunk ? '' : ',\n') + line);
      isFirstChunk = false;
    }

    updateStudentTracking(data);

    totalFetched += data.length;
    const lastRecord = data[data.length - 1];
    last_created_at = lastRecord.created_at;
    last_mentor_id = lastRecord.mentor_id;

    logProgress(`✅ Fetched ${data.length} records (Total: ${totalFetched})`);
  }

  writeStream.write('\n]');
  writeStream.end();

  logProgress(`🎉 All done. Total records: ${totalFetched}`);
  logProgress(`📁 Data written to ${OUTPUT_FILE}`);
  logProgress(`📊 Unique student IDs: ${uniqueStudentIds.size}`);
  logProgress(`🔁 Duplicate student IDs: ${duplicateStudentIds.size}`);
}

fetchAllData().catch((err) => {
  console.error('❌ Fatal error:', err.message);
});

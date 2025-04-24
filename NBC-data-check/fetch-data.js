const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Your API details
const BASE_URL = 'http://103.154.251.109:5000/data/student-assessment-data';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRwSFNCOUYteGw5OGZLSnJ0LVEyVDV6UjQ3cyJ9.eyJhdWQiOiJjZDA4ZmJlMC1mYmU2LTQzYzktOGQ1Yy01YmJjMzNiYTBkOWMiLCJleHAiOjE3NDQ3OTAxNjQsImlhdCI6MTc0NDcwMzc2NCwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyNmFhMDFlNi0wOTg0LTQyZDctYWM2MS1mNmQ1YWI3M2E0MmUiLCJqdGkiOiI2ODVmNmRjMi0yYzE1LTQzNWUtYmQ5Yi1mMTgyODZmMGY0MzIiLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6ImNvbnNvbGUtYWRtaW4iLCJhcHBsaWNhdGlvbklkIjoiY2QwOGZiZTAtZmJlNi00M2M5LThkNWMtNWJiYzMzYmEwZDljIiwicm9sZXMiOlsiQWRtaW4iXSwiYXV0aF90aW1lIjoxNzQ0NzAzNzY0LCJ0aWQiOiIwMTA1NjZmZC1lMWNiLWM2NTgtYjY1OS1hMWQzZTA3MGJhYTgiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiQWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiQWRtaW4ifX0.izBaXkYV8ijbmH_c4yH4MDcUF-oHVSIIyN9CpXFgS6U0nnA-VCbSBKKnUpPCDK1B47kHNaqudGPQyNuj2FjzRR7e5eYCkUTzB5nHynpveHs-zymKM4qD1nA-E6h_yEhadGXEkFVCULwCU4tDZvtjN-26T6kyQg8kokNkJxzv_IectkC7MfLY8xCn9c7DbfDMg50_DvHSbrW5eakaCKyC2KgH9D0vZIlPhybSAsHe7Rxj4m3gi45F95rvv2YstapNXQv_IwkGmkxOEdYjViDMYs5yMvmfdirhxUC7AkPa3R0LKpMqHj_f2Vr7vUYydha1U-PvmA0DE6Oi4f9-d2LWJQ'; // Replace with your actual token

// Params and constants
const params = {
  from_date: '2025-03-01',
  to_date: '2025-03-25',
  actor_type: 'mentor',
};

const PAGE_SIZE = 100000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

const OUTPUT_FILE = path.resolve(__dirname, `data/${params.actor_type}-assessment-result.json`);

// Convert current time to IST
function getISTTime() {
  const now = new Date();
  const istOffset = 5.5 * 60; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset * 60000);
  return istTime.toISOString().replace('T', ' ').split('.')[0] + ' IST';
}

function logProgress(message) {
  console.log(`[${getISTTime()}] ${message}`);
}

async function fetchWithRetry(offset, attempt = 1) {
  try {
    const response = await axios.get(BASE_URL, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      params: {
        ...params,
        offset,
      },
    });
    return response.data;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt;
      logProgress(`Retry ${attempt} after ${delay}ms due to error: ${error.message}`);
      await new Promise((res) => setTimeout(res, delay));
      return fetchWithRetry(offset, attempt + 1);
    } else {
      throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
    }
  }
}

async function fetchAllData() {
  let offset = 0;
  let totalFetched = 0;
  let isFirstChunk = true;

  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });
  writeStream.write('[\n');

  while (true) {
    logProgress(`Fetching offset: ${offset}`);
    const data = await fetchWithRetry(offset);

    if (!Array.isArray(data) || data.length === 0) {
      logProgress('No more data. Finished fetching.');
      break;
    }

    for (let i = 0; i < data.length; i++) {
      const line = JSON.stringify(data[i], null, 0);
      writeStream.write((isFirstChunk ? '' : ',\n') + line);
      isFirstChunk = false;
    }

    totalFetched += data.length;
    logProgress(`✅ Fetched ${data.length} records (Total: ${totalFetched})`);

    offset += PAGE_SIZE;
  }

  writeStream.write('\n]');
  writeStream.end();
  logProgress(`🎉 All done. Total records: ${totalFetched}`);
  logProgress(`📁 Data written to ${OUTPUT_FILE}`);
}

fetchAllData().catch((err) => {
  console.error('❌ Fatal error:', err.message);
});

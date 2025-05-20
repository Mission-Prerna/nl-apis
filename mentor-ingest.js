const fs = require('fs');
const path = require('path');
const axios = require('axios');
const XLSX = require('xlsx');

// Replace with your actual paths
const inputFile = path.resolve(__dirname, 'mentor-data.json');
const errorFile = path.resolve(__dirname, 'mentor-ingestion-errors.xlsx');

// Replace with your actual API endpoint
const apiEndpoint = "https://api.nl.samagra.io/admin/mentor/old";
const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRwSFNCOUYteGw5OGZLSnJ0LVEyVDV6UjQ3cyJ9.eyJhdWQiOiJjZDA4ZmJlMC1mYmU2LTQzYzktOGQ1Yy01YmJjMzNiYTBkOWMiLCJleHAiOjE3NDc3MjE4MDAsImlhdCI6MTc0NzYzNTQwMCwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyNmFhMDFlNi0wOTg0LTQyZDctYWM2MS1mNmQ1YWI3M2E0MmUiLCJqdGkiOiJlYjRkNTlmOS1hNWY5LTRlMjgtYWUwZi04MTAyYzcwMGRkZTciLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6ImNvbnNvbGUtYWRtaW4iLCJhcHBsaWNhdGlvbklkIjoiY2QwOGZiZTAtZmJlNi00M2M5LThkNWMtNWJiYzMzYmEwZDljIiwicm9sZXMiOlsiQWRtaW4iXSwiYXV0aF90aW1lIjoxNzQ3NjM1NDAwLCJ0aWQiOiIwMTA1NjZmZC1lMWNiLWM2NTgtYjY1OS1hMWQzZTA3MGJhYTgiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiQWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiQWRtaW4ifX0.FzZn4tYa03jcfb4K6mEGiqsk8ZbJHPNgGTOxVbup6N2k553c33h3z9gA1Q37Y4H-gAOTjQSeVU5eWdIE4WWlj8OUXno2y0kN1XjhikWjygxazLFmJQiKTRZho9clFvs5hnORR_utIgOQj553ViRxJPIhTc2CVDI04NzwHH34OQGOdAm_LjQnWH25BLlmAFMZmkju-KamcsoaxG0rTJLpa1vXMFewGDTKFvBvFc5AR2e6-5twH7eeZPAranXKniPNvhMq8IVnAfoJpBCv9xfEYD1UdoKbMj5ITexznSkPT36qs7mR0WaeAEx9HUPxs0PdsnUDvwmkwHs71oJjfngdmw';

async function main() {
  try {
    const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`Read ${jsonData.length} records from ${inputFile}`);
    const errors = [];

    for (const item of jsonData) {
      console.log(`Posting data for number :`, item.phone_no);
      try {
        const {data} = await axios.post(apiEndpoint, item, { headers:{
          'Authorization': `Bearer ${token}`,
        } });
        console.log(`Success data for phone:`, data.phone_no);
      } catch (err) {
        const errorMessage = err.response?.data?.message || ['Unknown error'];
        console.error(`Error posting data:`, errorMessage);
        errors.push({ 'SR No.': "", ...item, error: errorMessage.join(', ') });
      }
    }

    console.log(`Processed ${jsonData.length} records with ${errors.length} errors.`);

    if (errors.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(errors);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'mentor-ingestion-errors');
      XLSX.writeFile(workbook, errorFile);
      console.log(`Errors written to ${errorFile}`);
    } else {
      console.log('All data processed without errors.');
    }
  } catch (err) {
    console.error('Failed to read or process the file:', err.message);
  }
}

main();

const fs = require('fs');
const axios = require('axios');

const inputJsonFile = 'invalidate-assessment-school-list.json'; // Change this to your extracted JSON file name
const errorLogFile = 'errors-invalidate-assessment-school-list.log';
const apiUrl = 'https://api.nl.samagra.io/admin/assessment-cycle/11/invalidate-examiner-assessments';

const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRwSFNCOUYteGw5OGZLSnJ0LVEyVDV6UjQ3cyJ9.eyJhdWQiOiJjZDA4ZmJlMC1mYmU2LTQzYzktOGQ1Yy01YmJjMzNiYTBkOWMiLCJleHAiOjE3NDI2NDA5ODIsImlhdCI6MTc0MjU1NDU4MiwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyNmFhMDFlNi0wOTg0LTQyZDctYWM2MS1mNmQ1YWI3M2E0MmUiLCJqdGkiOiI1OWUzNDlmNS0wZjhiLTQ0NTAtYTMwOC00OGMwMDdhMDNmMTIiLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6ImNvbnNvbGUtYWRtaW4iLCJhcHBsaWNhdGlvbklkIjoiY2QwOGZiZTAtZmJlNi00M2M5LThkNWMtNWJiYzMzYmEwZDljIiwicm9sZXMiOlsiQWRtaW4iXSwiYXV0aF90aW1lIjoxNzQyNTU0NTgyLCJ0aWQiOiIwMTA1NjZmZC1lMWNiLWM2NTgtYjY1OS1hMWQzZTA3MGJhYTgiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiQWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiQWRtaW4ifX0.tPlp1zYmV6iwiFxkZA1j3Fvx7O5kMSHDTgvrDOCv8aEEiojdCWHN43BXdazdo7Ou1adFpCxDadA2TMHDaH34q7h66403rImQLCcxoh7-9VPX5Jc-020Bdj95D9yCLn6nN4yFiy40Bel15Z-sUnM27VG5qBDDDpcmlrtj3RhdVkyQHw_eoio7jod1QIskXXv1dvRiMft6wUnpNgHvuDBFxg7EuSSE0LrXSmC4VkQ--kYyl-vmS2oTtvvSDi25e-XwXTy2DzCu-fpP6a1VjP21oh6uAsdqdSovmo0BHWoRM7Cyj982rObwb4g_pEO9b89puvG16KkjTWsSfDc5_6EpRQ";


const errors = [];

fs.readFile(inputJsonFile, 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading JSON file:', err);
    return;
  }

  let results;
  try {
    results = JSON.parse(data);
  } catch (parseError) {
    console.error('Error parsing JSON file:', parseError);
    return;
  }

  for (const item of results) {
    const payload = {
      udises: [Number(item.UDISE)],
      reset_all: true,
      delete_all: false,
      mentor_id: +item.Mentor_Id
    }
    console.log('Sending data:', JSON.stringify(payload));
    try {
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Data sent successfully:', response.data);
    } catch (error) {
      console.error('Error sending data:', error.message);
      errors.push({ ...payload, error: error.message });
    }
  }

  if (errors.length > 0) {
    fs.writeFile(errorLogFile, JSON.stringify(errors, null, 2), (err) => {
      if (err) {
        console.error('Error writing error log file:', err);
      } else {
        console.log('Errors logged to:', errorLogFile);
      }
    });
  }
});

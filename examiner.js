// Your nested data array
const dataList = [
  [
    {
      "mentor_id": 993932,
      "district_id": 4
    },
    {
      "mentor_id": 1008775,
      "district_id": 4
    },
    {
      "mentor_id": 373213,
      "district_id": 6
    },
    {
      "mentor_id": 673951,
      "district_id": 6
    },
    {
      "mentor_id": 16770,
      "district_id": 6
    },
    {
      "mentor_id": 16792,
      "district_id": 6
    },
    {
      "mentor_id": 15222,
      "district_id": 6
    },
    {
      "mentor_id": 25618,
      "district_id": 6
    },
    {
      "mentor_id": 17681,
      "district_id": 6
    },
    {
      "mentor_id": 15225,
      "district_id": 6
    },
    {
      "mentor_id": 1008887,
      "district_id": 6
    },
    {
      "mentor_id": 16844,
      "district_id": 6
    },
    {
      "mentor_id": 16813,
      "district_id": 6
    },
    {
      "mentor_id": 17898,
      "district_id": 6
    },
    {
      "mentor_id": 17381,
      "district_id": 6
    },
    {
      "mentor_id": 17731,
      "district_id": 6
    },
    {
      "mentor_id": 15256,
      "district_id": 6
    },
    {
      "mentor_id": 961677,
      "district_id": 6
    },
    {
      "mentor_id": 15242,
      "district_id": 6
    },
    {
      "mentor_id": 17361,
      "district_id": 6
    },
    {
      "mentor_id": 17611,
      "district_id": 6
    },
    {
      "mentor_id": 1011018,
      "district_id": 6
    },
    {
      "mentor_id": 15212,
      "district_id": 6
    },
    {
      "mentor_id": 778756,
      "district_id": 6
    },
    {
      "mentor_id": 1011278,
      "district_id": 6
    },
    {
      "mentor_id": 16824,
      "district_id": 6
    },
    {
      "mentor_id": 375842,
      "district_id": 6
    },
    {
      "mentor_id": 17436,
      "district_id": 6
    },
    {
      "mentor_id": 1011282,
      "district_id": 6
    },
    {
      "mentor_id": 17607,
      "district_id": 6
    },
    {
      "mentor_id": 17508,
      "district_id": 6
    },
    {
      "mentor_id": 16843,
      "district_id": 6
    },
    {
      "mentor_id": 961624,
      "district_id": 6
    },
    {
      "mentor_id": 1011287,
      "district_id": 6
    },
    {
      "mentor_id": 1010642,
      "district_id": 6
    },
    {
      "mentor_id": 1011289,
      "district_id": 6
    },
    {
      "mentor_id": 16891,
      "district_id": 6
    },
    {
      "mentor_id": 16897,
      "district_id": 6
    },
    {
      "mentor_id": 16866,
      "district_id": 6
    },
    {
      "mentor_id": 16807,
      "district_id": 6
    }
  ]
]


const cycleId = 11
// API endpoint and headers
const apiEndpoint = `https://api.nl.samagra.io/admin/assessment-cycle/${cycleId}/district-examiner-mapping`;
const apiToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRwSFNCOUYteGw5OGZLSnJ0LVEyVDV6UjQ3cyJ9.eyJhdWQiOiJjZDA4ZmJlMC1mYmU2LTQzYzktOGQ1Yy01YmJjMzNiYTBkOWMiLCJleHAiOjE3MzQ4NDE4NTQsImlhdCI6MTczMzk3Nzg1NCwiaXNzIjoiYWNtZS5jb20iLCJzdWIiOiIyNmFhMDFlNi0wOTg0LTQyZDctYWM2MS1mNmQ1YWI3M2E0MmUiLCJqdGkiOiI2M2ExM2E1OC0wZDdkLTQyODgtOTg4OC0yY2EzNTMzZDQxOWUiLCJhdXRoZW50aWNhdGlvblR5cGUiOiJQQVNTV09SRCIsInByZWZlcnJlZF91c2VybmFtZSI6ImNvbnNvbGUtYWRtaW4iLCJhcHBsaWNhdGlvbklkIjoiY2QwOGZiZTAtZmJlNi00M2M5LThkNWMtNWJiYzMzYmEwZDljIiwicm9sZXMiOlsiQWRtaW4iXSwiYXV0aF90aW1lIjoxNzMzOTc3ODU0LCJ0aWQiOiIwMTA1NjZmZC1lMWNiLWM2NTgtYjY1OS1hMWQzZTA3MGJhYTgiLCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsiQWRtaW4iXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiQWRtaW4ifX0.fLn0pillTMYpf23YFPxz6smytALAMojSPx5hgA7_xPh_xJrCNJaK0KgHDcKAxKitQ42YUDpLc103m43Arn4E1y4Qq6s0_wSkJwybPB0JoBYZhMlzQjLW3dA3ZiwWOd4xM1oWX9UniguoJ2OlG_69JgVk4A3jyTDV5W2nfwtvd4mTxzvuUGwFOEWYLIgQA1d3Yohkh6Og4rwCrnsQdAgWJBhv4b_aCE4AmMHMeuEm-pQndiQkgwxn2nVQa0AeecFDtr0T0AWswGDCKe_Fq8iz55sRzQoHdWNJz0av23G1-szVYgsh0bLJYGm6VkeSIa3sbJ38Zuf-BqBPxSanf28F8w"; // Replace with your actual token

// Function to make API calls
async function callApiWithNestedData(dataList) {
  for (const subArray of dataList) {
      try {
          // Make an API call with the current sub-array as the body
          const response = await fetch(apiEndpoint, {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${apiToken}`,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify(subArray)
          });

          if (!response.ok) {
              console.error(`\n Error: Failed to send data for ${JSON.stringify(subArray)}. Status: ${response.status}`);
              continue;
          }

          // Handle the response
          const result = await response.json();
          console.log(`\n Success: Sent data for ${JSON.stringify(subArray)}. Response:`, result);

      } catch (error) {
          console.error(`\n Error: Failed to send data for ${JSON.stringify(subArray)}.`, error);
      }
  }
}

// Call the function
callApiWithNestedData(dataList);

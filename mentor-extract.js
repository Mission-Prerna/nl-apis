const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Replace with your .xlsx file path
const inputFile = path.resolve(__dirname, 'New ARP.xlsx');
const outputFile = path.resolve(__dirname, 'mentor-data.json');

try {
  // Read the Excel file
  const workbook = XLSX.readFile(inputFile);

  // Get the first sheet name
  const sheetName = workbook.SheetNames[0];

  // Convert sheet to JSON
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet);  // ✅ no JSON.parse here

  const data = jsonData.map(item => ({
    phone_no: `+91${item['Mobile Number']}`,
    district_name: item['District'],
    block_town_name: item['Block/Town'],
    designation: item['Designation'],
    officer_name: item['Person Name'],
    area_type: item['Area Type'],
  }));

  // Write JSON to file
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');

  console.log(`Data written to ${outputFile}`);
} catch (error) {
  console.error('Error processing file:', error.message);
}

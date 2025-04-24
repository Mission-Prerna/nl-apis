const fs = require('fs');
const csv = require('csv-parser');

const inputCsvFile = 'invalidate-assessment-school-list.csv'; // Change this to your CSV file name
const outputJsonFile = 'invalidate-assessment-school-list.json';

const results = [];

fs.createReadStream(inputCsvFile)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    fs.writeFile(outputJsonFile, JSON.stringify(results, null, 2), (err) => {
      if (err) {
        console.error('Error writing JSON file:', err);
      } else {
        console.log('JSON file has been saved:', outputJsonFile);
      }
    });
  });

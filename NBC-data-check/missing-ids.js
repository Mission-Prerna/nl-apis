const fs = require('fs');

const jsonIds = new Set(JSON.parse(fs.readFileSync('data/student_ids_from_json.json', 'utf8')));
const sqlIds = new Set(JSON.parse(fs.readFileSync('data/student_ids_from_sql.json', 'utf8')));

const missingFromJson = [];

sqlIds.forEach(student => {
  if (!jsonIds.has(student.student_id)) {
    missingFromJson.push(student.student_id);
  }
});

console.log(`❌ Student IDs missing in JSON: ${missingFromJson.length}`);
fs.writeFileSync('data/missing_ids.json', JSON.stringify(missingFromJson, null, 2));

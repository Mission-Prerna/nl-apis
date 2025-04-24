const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, 'data/mentor-assessment-result.json');

function extractStudentIds() {
  fs.readFile(INPUT_FILE, 'utf8', (err, data) => {
    if (err) return console.error('Error:', err);

    const jsonData = JSON.parse(data);
    const ids = new Set();

    jsonData.forEach(item => {
      const sid = item?.student?.student_id;
      if (sid) ids.add(sid);
    });

    fs.writeFileSync('data/student_ids_from_json.json', JSON.stringify([...ids], null, 2));
    console.log(`✅ Extracted ${ids.size} student IDs to student_ids_from_json.json`);
  });
}

extractStudentIds();

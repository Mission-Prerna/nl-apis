const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, 'data/mentor-assessment-result.json');

function countUniqueStudents() {
  fs.readFile(INPUT_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error('❌ Error reading file:', err.message);
      return;
    }

    try {
      const allData = JSON.parse(data);

      const uniqueStudentIds = new Set();
      const duplicateIds = new Set();
      const seenIds = new Map(); // student_id -> count
      let totalRecords = 0;

      allData.forEach(item => {
        totalRecords++;
        const sid = item?.student?.student_id;

        if (sid) {
          const currentCount = seenIds.get(sid) || 0;
          seenIds.set(sid, currentCount + 1);
          if (currentCount >= 1) {
            duplicateIds.add(sid);
          }
          uniqueStudentIds.add(sid);
        }
      });

      console.log(`📦 Total records: ${totalRecords}`);
      console.log(`✅ Unique student_ids: ${uniqueStudentIds.size}`);
      console.log(`🔁 Duplicated student_ids: ${duplicateIds.size}`);
      console.log(`🧾 Total unique student_ids in SQL: 325187`);
      console.log(`⚠️ Difference (SQL - JSON): ${325187 - uniqueStudentIds.size}`);

      // Optional: write the duplicate IDs to a file for analysis
      fs.writeFileSync('duplicates.json', JSON.stringify([...duplicateIds], null, 2));
    } catch (parseError) {
      console.error('❌ Error parsing JSON:', parseError.message);
    }
  });
}

countUniqueStudents();

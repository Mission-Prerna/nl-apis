-- For mentor and Diet Mentor---------
SELECT Count(*) FROM (
    WITH Ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at ASC) AS rn
        FROM assessment_result_nl_dashboard_v2
        WHERE 
            created_at BETWEEN '2025-03-01' AND '2025-03-25'
            AND LOWER(actor) IN ('mentor', 'diet mentor')  
    )
    SELECT * FROM Ranked WHERE rn = 1
) AS filtered_results; -- 329955
------
SELECT COUNT(DISTINCT student_id) 
FROM assessment_result_nl_dashboard_v2
WHERE 
    created_at BETWEEN '2025-03-01' AND '2025-03-25'
    AND LOWER(actor) IN ('mentor', 'diet mentor'); -- 329955


----------------------------

------ For teacher --------------
SELECT Count(*) FROM (
    WITH Ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at ASC) AS rn
        FROM assessment_result_nl_dashboard_v2
        WHERE 
            created_at BETWEEN '2025-03-01' AND '2025-03-25'
            AND LOWER(actor) IN ('teacher')  -- Updated actor filter
    )
    SELECT * FROM Ranked WHERE rn = 1
) AS filtered_results; -- 1254004

----------

SELECT COUNT(DISTINCT student_id) 
FROM assessment_result_nl_dashboard_v2
WHERE 
    created_at BETWEEN '2025-03-01' AND '2025-03-25'
    AND LOWER(actor) IN ('teacher'); -- 1254004

----------------------------

--- For examiner --------------

SELECT Count(*) FROM (
    WITH Ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at ASC) AS rn
        FROM assessment_result_nl_dashboard_v2
        WHERE 
            created_at BETWEEN '2025-03-01' AND '2025-03-25'
            AND LOWER(actor) IN ('examiner')  -- Updated actor filter
    )
    SELECT * FROM Ranked WHERE rn = 1
) AS filtered_results; -- 66449
----------
SELECT COUNT(DISTINCT student_id) 
FROM assessment_result_nl_dashboard_v2
WHERE 
    created_at BETWEEN '2025-03-01' AND '2025-03-25'
    AND LOWER(actor) IN ('examiner'); -- 66449

-----------------------------

const fs = require('fs');

const filePath = "C:/Users/hp/Downloads/examiner.json"; // or use \\ for Windows paths
const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const uniqueValues = new Set();

jsonData.forEach(item => {
  if (item && item.student && item.student.student_id) {
    uniqueValues.add(item.student.student_id);
  }
});

console.log("Total count:", jsonData.length);
console.log("Unique count:", uniqueValues.size);
// const uniqueArray = Array.from(uniqueValues);
// console.log("Unique IDs:", uniqueArray);

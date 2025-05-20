* Soochi Based Competency *

- Soochi Based Competency mappings includes
   -- grade, subject, name, pass_percentage
   -- Should be active for Teachers or Teacher & Mentor Both ??? --
   if only teacher need to change logic so it should not come in mentor

   -- The number of screens shown for a given Soochi assessment should be configurable. The number of questions or screens can also differ across soochis.  ( Is it handled by ODK) ?? 
   
   -- The number of questions per screen should be configurable ( Is it handled by ODK or need to configure) ??
   -- Number of screens and questions per screen follow backend-configured logic. ??  (user level or actor level)
 ??

   -- Mapping of badge with soochi / new table with relation ??? ---


- Question Ingestion for Soochi Compenencies

- After Assessment completed on submission
  -- evaluate response based on predefined success criteria
  -- awarded a badge of success only on first success
  -- show earned badges on the student dashboard
  -- badge animation is shown with haptic and audio feedback. The badge animation should play only the first time a badge is earned.

- Teacher: Leaderboard 
  -- Rankings of all students in the class
  -- Badges earned by each student
  -- A summary of student progress across Soochis and Lakshya assessments  ( What will be in summary) ??

- Student List 
  -- Should all badges will be visible on student list page & will it be in only Soochi or everywhere


- Submission handling
  -- Should there be a new table to store Soochi bases assessment
  -- Should we store attempt history in new table with assessment status per student (grey/red/green) 
  -- result evaluation
  -- track and only get submission of current academic year and invalidate the old data

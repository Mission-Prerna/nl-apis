export function getCurrentAcademicYear(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // JavaScript months are 0-based

  if (month >= 4) {
    // From April to December → academic year starts this year
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    // From January to March → academic year is of previous year
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

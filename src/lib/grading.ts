// Safe to import on the client. Replace with your school's scale (CBC schools use performance levels).
export function gradeFor(m: number): string {
  if (m >= 80) return "A"; if (m >= 75) return "A-"; if (m >= 70) return "B+"; if (m >= 65) return "B";
  if (m >= 60) return "B-"; if (m >= 55) return "C+"; if (m >= 50) return "C"; if (m >= 45) return "C-";
  if (m >= 40) return "D+"; if (m >= 35) return "D"; if (m >= 30) return "D-"; return "E";
}
export function remarkFor(m: number): string {
  if (m >= 75) return "Excellent"; if (m >= 60) return "Good"; if (m >= 45) return "Average";
  if (m >= 30) return "Needs improvement"; return "Poor";
}

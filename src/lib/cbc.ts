// Kenya CBC learning areas by level. Periods/week are sensible defaults: adjust per school.
export type Cbc = { code: string; name: string; category: string; min: number; max: number; periods: number };
const LP = "Lower Primary (Gr 1-3)", UP = "Upper Primary (Gr 4-6)", JS = "Junior School (Gr 7-9)";
const SC = "Senior School: Core", ST = "Senior School: STEM", SS = "Senior School: Social Sciences", SA = "Senior School: Arts & Sports";

export const CBC_SUBJECTS: Cbc[] = [
  { code: "LP-ENG", name: "English Language Activities", category: LP, min: 1, max: 3, periods: 5 },
  { code: "LP-KIS", name: "Kiswahili Language Activities / KSL", category: LP, min: 1, max: 3, periods: 4 },
  { code: "LP-IND", name: "Indigenous Language Activities", category: LP, min: 1, max: 3, periods: 2 },
  { code: "LP-MAT", name: "Mathematical Activities", category: LP, min: 1, max: 3, periods: 5 },
  { code: "LP-REL", name: "Religious Activities (CRE/IRE/HRE)", category: LP, min: 1, max: 3, periods: 3 },
  { code: "LP-ENV", name: "Environmental Activities", category: LP, min: 1, max: 3, periods: 4 },
  { code: "LP-CRE", name: "Creative Activities", category: LP, min: 1, max: 3, periods: 5 },

  { code: "UP-ENG", name: "English", category: UP, min: 4, max: 6, periods: 5 },
  { code: "UP-KIS", name: "Kiswahili / KSL", category: UP, min: 4, max: 6, periods: 4 },
  { code: "UP-MAT", name: "Mathematics", category: UP, min: 4, max: 6, periods: 5 },
  { code: "UP-SCI", name: "Science & Technology", category: UP, min: 4, max: 6, periods: 4 },
  { code: "UP-SST", name: "Social Studies", category: UP, min: 4, max: 6, periods: 3 },
  { code: "UP-AGN", name: "Agriculture & Nutrition", category: UP, min: 4, max: 6, periods: 3 },
  { code: "UP-REL", name: "Religious Education (CRE/IRE/HRE)", category: UP, min: 4, max: 6, periods: 3 },
  { code: "UP-CAS", name: "Creative Arts", category: UP, min: 4, max: 6, periods: 3 },
  { code: "UP-PHE", name: "Physical & Health Education", category: UP, min: 4, max: 6, periods: 2 },

  { code: "JS-ENG", name: "English", category: JS, min: 7, max: 9, periods: 5 },
  { code: "JS-KIS", name: "Kiswahili / KSL", category: JS, min: 7, max: 9, periods: 4 },
  { code: "JS-MAT", name: "Mathematics", category: JS, min: 7, max: 9, periods: 5 },
  { code: "JS-ISC", name: "Integrated Science", category: JS, min: 7, max: 9, periods: 5 },
  { code: "JS-SST", name: "Social Studies", category: JS, min: 7, max: 9, periods: 3 },
  { code: "JS-AGN", name: "Agriculture & Nutrition", category: JS, min: 7, max: 9, periods: 3 },
  { code: "JS-PTS", name: "Pre-Technical Studies", category: JS, min: 7, max: 9, periods: 4 },
  { code: "JS-CAS", name: "Creative Arts & Sports", category: JS, min: 7, max: 9, periods: 3 },
  { code: "JS-REL", name: "Religious Education (CRE/IRE/HRE)", category: JS, min: 7, max: 9, periods: 3 },
  { code: "JS-FLG", name: "Foreign Languages (French/German/Arabic/Mandarin)", category: JS, min: 7, max: 9, periods: 2 },
  { code: "JS-IND", name: "Indigenous Languages", category: JS, min: 7, max: 9, periods: 2 },

  { code: "SS-ENG", name: "English (Core)", category: SC, min: 10, max: 12, periods: 5 },
  { code: "SS-KIS", name: "Kiswahili / KSL (Core)", category: SC, min: 10, max: 12, periods: 4 },
  { code: "SS-MAT", name: "Core Mathematics", category: SC, min: 10, max: 12, periods: 5 },
  { code: "SS-CSL", name: "Community Service Learning", category: SC, min: 10, max: 12, periods: 2 },
  { code: "SS-PE", name: "Physical Education", category: SC, min: 10, max: 12, periods: 2 },

  { code: "SS-BIO", name: "Biology", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-CHE", name: "Chemistry", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-PHY", name: "Physics", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-GSC", name: "General Science", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-ADV", name: "Advanced Mathematics", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-AGR", name: "Agriculture", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-CMP", name: "Computer Science", category: ST, min: 10, max: 12, periods: 5 },
  { code: "SS-HSC", name: "Home Science", category: ST, min: 10, max: 12, periods: 5 },

  { code: "SS-HIS", name: "History & Citizenship", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-GEO", name: "Geography", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-BUS", name: "Business Studies", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-CRE", name: "Christian Religious Education", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-IRE", name: "Islamic Religious Education", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-LIT", name: "Literature in English", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-FAS", name: "Fasihi ya Kiswahili", category: SS, min: 10, max: 12, periods: 5 },
  { code: "SS-FLG", name: "Foreign Languages", category: SS, min: 10, max: 12, periods: 5 },

  { code: "SS-MUS", name: "Music & Dance", category: SA, min: 10, max: 12, periods: 5 },
  { code: "SS-ART", name: "Fine Arts", category: SA, min: 10, max: 12, periods: 5 },
  { code: "SS-THE", name: "Theatre & Film", category: SA, min: 10, max: 12, periods: 5 },
  { code: "SS-SPR", name: "Sports & Recreation", category: SA, min: 10, max: 12, periods: 5 },
];

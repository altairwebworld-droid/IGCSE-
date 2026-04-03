import { Dna, FlaskConical, Atom, Coins, Briefcase, LineChart, BookA, Calculator, Globe, Code, TrendingUp, Target } from 'lucide-react';

export const IGCSE_SUBJECTS = [
  { name: "Biology – 0610", icon: Dna, color: "text-green-500", bg: "bg-green-100" },
  { name: "Chemistry – 0620", icon: FlaskConical, color: "text-purple-500", bg: "bg-purple-100" },
  { name: "Physics – 0625", icon: Atom, color: "text-blue-500", bg: "bg-blue-100" },
  { name: "Accounting – 0452", icon: Coins, color: "text-gray-600", bg: "bg-gray-100" },
  { name: "Business Studies – 0450", icon: Briefcase, color: "text-amber-600", bg: "bg-amber-100" },
  { name: "Economics – 0455", icon: LineChart, color: "text-emerald-600", bg: "bg-emerald-100" },
  { name: "English (First Language) – 0500", icon: BookA, color: "text-red-500", bg: "bg-red-100" },
  { name: "Mathematics – 0580 (Core/Extended)", icon: Calculator, color: "text-indigo-500", bg: "bg-indigo-100" },
  { name: "Geography – 0460", icon: Globe, color: "text-teal-500", bg: "bg-teal-100" },
  { name: "Computer Science – 0478", icon: Code, color: "text-slate-700", bg: "bg-slate-200" }
];

export const GRADING_THRESHOLDS = [
  { grade: 'A*', min: 90 },
  { grade: 'A', min: 80 },
  { grade: 'B', min: 70 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 50 },
  { grade: 'E', min: 40 },
  { grade: 'F', min: 30 },
  { grade: 'G', min: 20 },
  { grade: 'U', min: 0 },
];

export const getGrade = (percentage: number) => {
  for (const threshold of GRADING_THRESHOLDS) {
    if (percentage >= threshold.min) return threshold.grade;
  }
  return 'U';
};

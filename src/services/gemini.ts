import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, limit } from "firebase/firestore";

export interface GradingResult {
  isCorrect: boolean;
  marksAwarded: number;
  feedback: string;
  improvementTip: string;
}

const callAI = async (params: {
  prompt: string | any[];
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
}) => {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "AI Generation failed");
  }
  return await response.json();
};

export const evaluateAnswer = async (
  question: string,
  studentAnswer: string,
  correctAnswer: string,
  maxMarks: number
): Promise<GradingResult> => {
  const prompt = `
You are an expert Cambridge IGCSE examiner. Evaluate the student's answer based on the official Cambridge International mark scheme criteria.
Use simple, clear language that a student and their parent can easily understand. Avoid technical jargon where possible, but explain necessary subject-specific terms.

Question: ${question}
Model Correct Answer: ${correctAnswer}
Student Answer: ${studentAnswer}
Max Marks: ${maxMarks}

Provide a JSON response with:
- isCorrect: boolean (true if they got at least half marks, false otherwise)
- marksAwarded: number (between 0 and ${maxMarks})
- feedback: string (Detailed feedback in plain English. 
    1. Identify exactly what was done well.
    2. Explain what was missing or incorrect.
    3. Address common IGCSE misconceptions related to this topic if the student made them.
    4. Explain *why* specific keywords from the mark scheme are essential for full marks.
    5. Use bullet points for clarity.)
- improvementTip: string (A specific, actionable tip to get more marks next time. 
    - If it's a comparative question, suggest a structure (e.g., 'Both X and Y...', 'However, X is...').
    - If it's an explanation, suggest the 'State, Explain, Example' approach.
    - Focus on keyword usage and answer structure.
    - The tip MUST always end with the exact phrase: "According to the International IGCSE standards.")
`;

  try {
    const result = await callAI({
      prompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          isCorrect: { type: "BOOLEAN" },
          marksAwarded: { type: "NUMBER" },
          feedback: { type: "STRING" },
          improvementTip: { type: "STRING" },
        },
        required: ["isCorrect", "marksAwarded", "feedback", "improvementTip"],
      },
    });

    return JSON.parse(result.text) as GradingResult;
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return {
      isCorrect: false,
      marksAwarded: 0,
      feedback: "Error evaluating answer. Please try again.",
      improvementTip: "N/A",
    };
  }
};

export const askGeneralQuestion = async (queryText: string): Promise<string> => {
  try {
    const result = await callAI({ prompt: queryText });
    return result.text || "I couldn't find an answer to that.";
  } catch (error) {
    console.error("Error asking general question:", error);
    return "Sorry, I encountered an error while searching for the answer.";
  }
};

export interface GeneratedQuestion {
  id: string;
  type: 'open' | 'multiple-choice' | 'multiple-select' | 'fill-in-the-blanks' | 'matching';
  text: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer: string;
  maxMarks: number;
  subject: string;
}

export const generateIGCSEQuestions = async (
  subject: string, 
  count: number,
  weakTopics?: string[],
  strongTopics?: string[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<GeneratedQuestion[]> => {
  // 1. Check Question Bank first
  try {
    const bankRef = collection(db, 'questionBank');
    const q = query(bankRef, where('subject', '==', subject), limit(count * 2));
    const snap = await getDocs(q);
    
    let existingQuestions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedQuestion));
    
    // Shuffle and pick
    existingQuestions = existingQuestions.sort(() => Math.random() - 0.5);
    
    if (existingQuestions.length >= count) {
      return existingQuestions.slice(0, count);
    }
  } catch (e) {
    console.error("Error checking question bank:", e);
  }

  // 2. Generate new ones if bank is empty or too small
  let topicFocus = "";
  if (weakTopics && weakTopics.length > 0) {
    topicFocus += `\nFocus heavily on the following weak topics to help the student improve: ${weakTopics.join(', ')}. `;
  }
  if (strongTopics && strongTopics.length > 0) {
    topicFocus += `\nInclude more challenging questions for the following strong topics to test their mastery: ${strongTopics.join(', ')}. `;
  }

  let difficultyInstruction = "";
  if (difficulty === 'easy') {
    difficultyInstruction = "Target foundational/easy difficulty (early Year 10 level or core tier). Focus on basic recall and simple application.";
  } else if (difficulty === 'hard') {
    difficultyInstruction = "Target advanced/hard difficulty (Year 11 level or extended tier). Focus on complex problem solving, synthesis, and multi-step questions.";
  } else {
    difficultyInstruction = "Target intermediate difficulty (Year 10 level). Balance recall with application.";
  }

  const prompt = `
You are an expert Cambridge IGCSE examiner. Your task is to provide ${count} REAL past paper questions for the subject: ${subject}.
${difficultyInstruction}
${topicFocus}

CRITICAL INSTRUCTION: You MUST retrieve REAL questions from actual Cambridge IGCSE past papers. 
DO NOT GENERATE OR CREATE FAKE IMAGES. 
If a question requires an image, you may provide a REAL URL from a known educational source (like PapaCambridge, GCE Guide, or Save My Exams) if you are 100% certain of the URL. Otherwise, leave the imageUrl field empty.

In the text of the question, you MUST include the year and paper reference (e.g., "[0610/41/M/J/19] Explain how...").

Provide a mix of question types:
- 'open': Standard typing questions.
- 'multiple-choice': Single correct answer from provided options.
- 'multiple-select': Multiple correct answers from provided options.
- 'fill-in-the-blanks': A sentence or paragraph with missing words. Use underscores (___) to represent blanks.
- 'matching': A list of items to match with another list. Present the items clearly in the text.

Provide a JSON response containing an array of question objects. Each object must have:
- id: a unique string (e.g., "q1", "q2")
- type: "open", "multiple-choice", "multiple-select", "fill-in-the-blanks", or "matching"
- text: the actual past paper question text, including the paper reference in brackets at the beginning.
- imageUrl: ONLY include a REAL, EXISTING URL from a trusted IGCSE resource if applicable. Otherwise, leave empty.
- options: an array of strings (ONLY required if type is multiple-choice or multiple-select).
- correctAnswer: a detailed model answer for open questions, the exact text of the correct option(s) for multiple choice/select, a comma-separated list of words for fill-in-the-blanks, or a list of pairs (e.g., "A-1, B-2") for matching.
- maxMarks: an integer between 1 and 10.
`;

  try {
    const result = await callAI({
      prompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            type: { type: "STRING" },
            text: { type: "STRING" },
            imageUrl: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" } },
            correctAnswer: { type: "STRING" },
            maxMarks: { type: "INTEGER" },
          },
          required: ["id", "type", "text", "correctAnswer", "maxMarks"],
        }
      },
    });

    const newQuestions = JSON.parse(result.text) as GeneratedQuestion[];
    
    // 3. Save new questions to bank (background)
    newQuestions.forEach(async (q) => {
      try {
        await addDoc(collection(db, 'questionBank'), {
          ...q,
          subject,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Error saving to bank:", e);
      }
    });

    return newQuestions;
  } catch (error) {
    console.error("Error generating questions:", error);
    return [];
  }
};

export interface PerformanceAnalysis {
  masteryPercentage: number;
  weeklyImprovement: number;
  weakTopics: string[];
  strongTopics: string[];
}

export const analyzeStudentPerformance = async (
  attempts: any[],
  currentStats: any
): Promise<PerformanceAnalysis> => {
  const prompt = `
You are an expert educational data analyst. Analyze the student's recent task attempts and current overall statistics.
Use simple language. Avoid terms like "mastery" if possible; use "Learning Progress" instead.

Current Stats:
- Learning Progress: ${currentStats?.masteryPercentage || 0}%
- Improvement: ${currentStats?.weeklyImprovement || 0}%
- Weak Topics: ${currentStats?.weakTopics?.join(', ') || 'None'}
- Strong Topics: ${currentStats?.strongTopics?.join(', ') || 'None'}

Recent Task Attempts:
${JSON.stringify(attempts.map(a => ({
  question: a.questionText,
  isCorrect: a.isCorrect,
  marksAwarded: a.marksAwarded,
  feedback: a.feedback
})), null, 2)}

Based on this data, provide a JSON response with:
- masteryPercentage: number (0-100, ensure it is a valid number, never infinity)
- weeklyImprovement: number
- weakTopics: array of strings (Specific topic names like "Cell Structure", "Electrolysis", etc. NOT just subject names.)
- strongTopics: array of strings (Specific topic names.)
`;

  try {
    const result = await callAI({
      prompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          masteryPercentage: { type: "NUMBER" },
          weeklyImprovement: { type: "NUMBER" },
          weakTopics: { type: "ARRAY", items: { type: "STRING" } },
          strongTopics: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["masteryPercentage", "weeklyImprovement", "weakTopics", "strongTopics"],
      },
    });

    return JSON.parse(result.text) as PerformanceAnalysis;
  } catch (error) {
    console.error("Error analyzing performance:", error);
    return {
      masteryPercentage: currentStats?.masteryPercentage || 0,
      weeklyImprovement: currentStats?.weeklyImprovement || 0,
      weakTopics: currentStats?.weakTopics || [],
      strongTopics: currentStats?.strongTopics || [],
    };
  }
};

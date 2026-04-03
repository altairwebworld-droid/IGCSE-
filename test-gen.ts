import { generateIGCSEQuestions } from './src/services/gemini.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log("Generating questions...");
  const q = await generateIGCSEQuestions("Biology - 0610", 2, [], [], "hard");
  console.log(JSON.stringify(q, null, 2));
}
test();

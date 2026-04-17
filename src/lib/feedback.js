import { callClaude } from './claude.js';
import { buildFeedbackPrompt } from '../prompts/feedback.js';

function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}

export async function analyseRevisions({ originals, revised }) {
  const prompt = buildFeedbackPrompt({ originals, revised });
  const raw = await callClaude({ prompt });
  try {
    return extractJson(raw);
  } catch {
    throw new Error('Could not parse feedback analysis from Claude.');
  }
}

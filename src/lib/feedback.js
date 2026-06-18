import { callClaude } from './claude.js';
import { buildFeedbackPrompt } from '../prompts/feedback.js';

function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}

export async function analyseRevisions({ originals, revised, turnstileToken }) {
  const prompt = buildFeedbackPrompt({ originals, revised });
  const { text } = await callClaude({ prompt, turnstileToken });
  try {
    return extractJson(text);
  } catch {
    throw new Error('Could not parse feedback analysis from Claude.');
  }
}

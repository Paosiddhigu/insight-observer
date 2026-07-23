export const MODEL = 'gpt-5.6-luna';

export function getResponseText(response) {
  if (response.output_text?.trim()) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text;
      }
    }
  }

  return '';
}

export async function createModelResponse(openai, { instructions, input, maxOutputTokens }) {
  const response = await openai.responses.create({
    model: MODEL,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
  });

  return getResponseText(response);
}

import { GoogleGenAI } from '@google/genai'

export async function geminiSuggestReply(args: { apiKey: string; prompt: string }) {
  const ai = new GoogleGenAI({ apiKey: args.apiKey })
  const res = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: args.prompt
  })
  return (res.text ?? '').trim()
}


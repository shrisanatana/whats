import { GoogleGenAI } from '@google/genai'

export async function geminiSuggestReply(args: { apiKey: string; prompt: string; model?: string }) {
  const ai = new GoogleGenAI({ apiKey: args.apiKey })
  const res = await ai.models.generateContent({
    model: args.model || 'gemini-1.5-flash',
    contents: args.prompt
  })
  return (res.text ?? '').trim()
}


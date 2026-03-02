import OpenAI from 'openai'

export async function openaiSuggestReply(args: { apiKey: string; prompt: string }) {
  const client = new OpenAI({ apiKey: args.apiKey })
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: args.prompt }],
    temperature: 0.4
  })
  const text = res.choices[0]?.message?.content?.trim() ?? ''
  return text
}


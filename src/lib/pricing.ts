// Precios por 1M tokens (USD). Fuente: precios oficiales mayo 2026.
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  // Anthropic
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.1 },
  // Google
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-pro': { input: 2, output: 5 },
  // Groq
  'llama3-70b': { input: 0.59, output: 0.79 },
  'llama3-8b': { input: 0.05, output: 0.08 },
  'mixtral-8x7b': { input: 0.24, output: 0.24 },
  // Cohere
  'command-r': { input: 0.5, output: 1.5 },
  'command-r-plus': { input: 3, output: 15 },
}

export function estimateTokens(text: string): number {
  return Math.round(text.length / 4)
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } | null {
  const pricing = PRICING[model] ?? guessPricing(model)
  if (!pricing) return null

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  }
}

function guessPricing(model: string): { input: number; output: number } | null {
  if (model.includes('gpt-4o')) return { input: 2.5, output: 10 }
  if (model.includes('gpt-4')) return { input: 10, output: 30 }
  if (model.includes('gpt-3.5')) return { input: 0.5, output: 1.5 }
  if (model.includes('claude')) return { input: 3, output: 15 }
  if (model.includes('deepseek')) return { input: 0.27, output: 1.1 }
  if (model.includes('gemini')) return { input: 0.1, output: 0.4 }
  if (model.includes('command')) return { input: 0.5, output: 1.5 }
  return null
}

export function formatCost(usd: number): string {
  if (usd < 0.0001) return '< $0.0001'
  return `$${usd.toFixed(4)}`
}

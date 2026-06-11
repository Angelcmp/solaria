import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { estimateTokens, estimateCost, formatCost } from '../lib/pricing'

export interface ComparisonModel {
  providerId: string
  modelName: string
  label: string
}

export interface ComparisonResponse {
  blindLabel: string
  content: string
  tokens: number
  latencyMs: number
  error?: string
}

export interface ComparisonRound {
  prompt: string
  models: ComparisonModel[]
  blindMap: { label: string; providerId: string; modelName: string }[]
  responses: ComparisonResponse[]
  voted: string | null
  revealed: boolean
  startTime: number
}

export interface ComparisonSession {
  rounds: ComparisonRound[]
  currentRoundIndex: number
  isStreaming: boolean
  comparing: boolean
}

const BLIND_LABELS = ['Modelo A', 'Modelo B', 'Modelo C', 'Modelo D']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useComparison() {
  const [session, setSession] = useState<ComparisonSession>({
    rounds: [],
    currentRoundIndex: -1,
    isStreaming: false,
    comparing: false,
  })

  const isActive = session.comparing

  const openComparator = useCallback(() => {
    setSession(s => ({ ...s, comparing: true }))
  }, [])

  const closeComparator = useCallback(() => {
    setSession({ rounds: [], currentRoundIndex: -1, isStreaming: false, comparing: false })
  }, [])

  const startComparison = useCallback(async (
    prompt: string,
    models: { providerId: string; modelName: string; apiKey?: string }[],
    temperature?: number,
    topP?: number,
    maxTokens?: number,
  ): Promise<ComparisonRound> => {
    const shuffled = shuffle(models)
    const blindMap = shuffled.map((m, i) => ({
      label: BLIND_LABELS[i],
      providerId: m.providerId,
      modelName: m.modelName,
    }))

    const round: ComparisonRound = {
      prompt,
      models: shuffled.map((m, i) => ({ ...m, label: BLIND_LABELS[i] })),
      blindMap,
      responses: blindMap.map(bm => ({
        blindLabel: bm.label,
        content: '',
        tokens: 0,
        latencyMs: 0,
      })),
      voted: null,
      revealed: false,
      startTime: Date.now(),
    }

    setSession(s => ({
      ...s,
      isStreaming: true,
      rounds: [...s.rounds],
      currentRoundIndex: s.rounds.length,
    }))

    const roundIndex = session.rounds.length

    const streamIds: string[] = []
    const unlisteners: UnlistenFn[] = []
    const startTimes: number[] = []
    const settledFlags: boolean[] = []
    const contentBuf: string[] = []
    const settledCount = { value: 0 }
    const roundRef = { current: { ...round } }

    const modelParams = {
      temperature: temperature ?? null,
      topP: topP ?? null,
      maxTokens: maxTokens ?? null,
    }

    for (let i = 0; i < shuffled.length; i++) {
      streamIds.push(crypto.randomUUID())
      startTimes.push(0)
      settledFlags.push(false)
      contentBuf.push('')
    }

    const updateResponse = (blindLabel: string, updates: Partial<ComparisonResponse>) => {
      roundRef.current = {
        ...roundRef.current,
        responses: roundRef.current.responses.map(r =>
          r.blindLabel === blindLabel ? { ...r, ...updates } : r
        ),
      }
      setSession(s => {
        const newRounds = [...s.rounds]
        newRounds[roundIndex] = roundRef.current
        return { ...s, rounds: newRounds }
      })
    }

    const setupListeners = async (index: number, blindLabel: string) => {
      const sid = streamIds[index]

      const unTok = await listen<{ stream_id: string; token: string }>('stream://token', (event) => {
        if (event.payload.stream_id !== sid) return
        if (settledFlags[index]) return
        contentBuf[index] += event.payload.token
        updateResponse(blindLabel, { content: contentBuf[index] })
      })
      unlisteners.push(unTok)

      let done = false
      const unDone = await listen<{ stream_id: string; full_content: string; cancelled: boolean }>('stream://done', (event) => {
        if (event.payload.stream_id !== sid) return
        if (done) return
        done = true
        settledFlags[index] = true
        settledCount.value++
        const now = Date.now()
        const latency = startTimes[index] > 0 ? now - startTimes[index] : 0
        updateResponse(blindLabel, {
          content: contentBuf[index] || event.payload.full_content,
          tokens: estimateTokens(contentBuf[index]),
          latencyMs: latency,
        })

        if (settledCount.value >= shuffled.length) {
          for (const u of unlisteners) u()
          setSession(s => ({ ...s, isStreaming: false }))
        }
      })
      unlisteners.push(unDone)

      const unErr = await listen<{ stream_id: string; error: string }>('stream://error', (event) => {
        if (event.payload.stream_id !== sid) return
        if (done) return
        done = true
        settledFlags[index] = true
        settledCount.value++
        const now = Date.now()
        updateResponse(blindLabel, {
          error: event.payload.error,
          latencyMs: startTimes[index] > 0 ? now - startTimes[index] : 0,
          content: contentBuf[index] || 'Error: ' + event.payload.error,
        })

        if (settledCount.value >= shuffled.length) {
          for (const u of unlisteners) u()
          setSession(s => ({ ...s, isStreaming: false }))
        }
      })
      unlisteners.push(unErr)
    }

    // Set up listeners for all models
    for (let i = 0; i < shuffled.length; i++) {
      await setupListeners(i, BLIND_LABELS[i])
    }

    // Start all streams in parallel
    const modelMessages = JSON.stringify([{ role: 'user' as const, content: prompt }])

    const promises = shuffled.map((model, i) => {
      const sid = streamIds[i]
      startTimes[i] = Date.now()
      if (model.providerId === 'ollama') {
        return invoke('ollama_chat_stream', {
          streamId: sid,
          model: model.modelName,
          messages: modelMessages,
          systemPrompt: null,
          temperature: modelParams.temperature,
          topP: modelParams.topP,
          maxTokens: modelParams.maxTokens,
        })
      } else {
        return invoke('provider_chat_stream', {
          streamId: sid,
          provider: model.providerId,
          model: model.modelName,
          apiKey: model.apiKey || '',
          messages: modelMessages,
          systemPrompt: null,
          temperature: modelParams.temperature,
          topP: modelParams.topP,
          maxTokens: modelParams.maxTokens,
        })
      }
    })

    Promise.allSettled(promises).catch(() => {})

    return roundRef.current
  }, [session.rounds.length])

  const vote = useCallback((winningLabel: string) => {
    setSession(s => {
      const newRounds = [...s.rounds]
      if (s.currentRoundIndex >= 0 && s.currentRoundIndex < newRounds.length) {
        newRounds[s.currentRoundIndex] = { ...newRounds[s.currentRoundIndex], voted: winningLabel }
      }
      return { ...s, rounds: newRounds }
    })
  }, [])

  const reveal = useCallback(() => {
    setSession(s => {
      const newRounds = [...s.rounds]
      if (s.currentRoundIndex >= 0 && s.currentRoundIndex < newRounds.length) {
        newRounds[s.currentRoundIndex] = { ...newRounds[s.currentRoundIndex], revealed: true }
      }
      return { ...s, rounds: newRounds }
    })
  }, [])

  const getCostComparison = useCallback((round: ComparisonRound) => {
    return round.responses.map(r => {
      const info = round.blindMap.find(bm => bm.label === r.blindLabel)
      if (!info) return { ...r, providerId: '', modelName: '', cost: null, costStr: '' }
      const tokens = r.tokens || estimateTokens(r.content)
      const cost = estimateCost(info.modelName, 0, tokens)
      const costStr = cost ? formatCost(cost.totalCost) : 'local'
      return { ...r, providerId: info.providerId, modelName: info.modelName, cost, costStr }
    })
  }, [])

  const currentRound = session.currentRoundIndex >= 0 && session.currentRoundIndex < session.rounds.length
    ? session.rounds[session.currentRoundIndex]
    : null

  return {
    session,
    isActive,
    currentRound,
    isStreaming: session.isStreaming,
    openComparator,
    closeComparator,
    startComparison,
    vote,
    reveal,
    getCostComparison,
  }
}

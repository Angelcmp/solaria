import { useState, useEffect, useCallback } from 'react'

export type MatterType = 'civil' | 'laboral' | 'penal' | 'mercantil' | 'administrativo' | 'familiar' | 'otro'
export type CaseStatus = 'active' | 'archived' | 'closed'

export interface LegalCase {
  id: string
  clientName: string
  caseName: string
  caseNumber?: string
  matterType: MatterType
  status: CaseStatus
  path: string
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface LegalDeadline {
  id: string
  caseId: string
  title: string
  date: string
  priority: 'low' | 'medium' | 'high'
  completed: boolean
}

export interface LegalDocument {
  id: string
  caseId?: string
  name: string
  path: string
  type: 'contract' | 'brief' | 'motion' | 'evidence' | 'note' | 'ruling' | 'other'
  createdAt: number
  updatedAt: number
}

const CASES_KEY = 'solaria-legal-cases'
const DEADLINES_KEY = 'solaria-legal-deadlines'
const DOCUMENTS_KEY = 'solaria-legal-documents'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function useLegalWorkspace() {
  const [cases, setCases] = useState<LegalCase[]>(() => load(CASES_KEY, []))
  const [deadlines, setDeadlines] = useState<LegalDeadline[]>(() => load(DEADLINES_KEY, []))
  const [documents, setDocuments] = useState<LegalDocument[]>(() => load(DOCUMENTS_KEY, []))

  useEffect(() => save(CASES_KEY, cases), [cases])
  useEffect(() => save(DEADLINES_KEY, deadlines), [deadlines])
  useEffect(() => save(DOCUMENTS_KEY, documents), [documents])

  const addCase = useCallback((data: Omit<LegalCase, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const now = Date.now()
    const newCase: LegalCase = {
      ...data,
      id: crypto.randomUUID(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    setCases(prev => [newCase, ...prev])
    return newCase
  }, [])

  const updateCase = useCallback((id: string, updates: Partial<LegalCase>) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c))
  }, [])

  const archiveCase = useCallback((id: string) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, status: 'archived', updatedAt: Date.now() } : c))
  }, [])

  const closeCase = useCallback((id: string) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, status: 'closed', updatedAt: Date.now() } : c))
  }, [])

  const restoreCase = useCallback((id: string) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, status: 'active', updatedAt: Date.now() } : c))
  }, [])

  const deleteCase = useCallback((id: string) => {
    setCases(prev => prev.filter(c => c.id !== id))
    setDeadlines(prev => prev.filter(d => d.caseId !== id))
    setDocuments(prev => prev.filter(d => d.caseId !== id))
  }, [])

  const addDeadline = useCallback((data: Omit<LegalDeadline, 'id' | 'completed'>) => {
    const newDeadline: LegalDeadline = { ...data, id: crypto.randomUUID(), completed: false }
    setDeadlines(prev => [...prev, newDeadline])
    return newDeadline
  }, [])

  const updateDeadline = useCallback((id: string, updates: Partial<LegalDeadline>) => {
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
  }, [])

  const toggleDeadline = useCallback((id: string) => {
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, completed: !d.completed } : d))
  }, [])

  const deleteDeadline = useCallback((id: string) => {
    setDeadlines(prev => prev.filter(d => d.id !== id))
  }, [])

  const addDocument = useCallback((data: Omit<LegalDocument, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now()
    const newDoc: LegalDocument = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    setDocuments(prev => [newDoc, ...prev])
    return newDoc
  }, [])

  const updateDocument = useCallback((id: string, updates: Partial<LegalDocument>) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d))
  }, [])

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id))
  }, [])

  const activeCases = cases.filter(c => c.status === 'active')
  const archivedCases = cases.filter(c => c.status === 'archived')
  const closedCases = cases.filter(c => c.status === 'closed')

  const upcomingDeadlines = deadlines
    .filter(d => !d.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    cases,
    activeCases,
    archivedCases,
    closedCases,
    deadlines,
    upcomingDeadlines,
    documents,
    addCase,
    updateCase,
    archiveCase,
    closeCase,
    restoreCase,
    deleteCase,
    addDeadline,
    updateDeadline,
    toggleDeadline,
    deleteDeadline,
    addDocument,
    updateDocument,
    deleteDocument,
  }
}

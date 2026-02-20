'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { generateUUID } from '@/lib/utils'
import { FiSend, FiChevronDown, FiChevronUp } from 'react-icons/fi'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------
const AGENT_ID = '6998bfc611c834a827fbb621'

const SUGGESTIONS = [
  'What is 25% of 380?',
  'Convert 5 miles to kilometers',
  'Solve 3x - 7 = 20',
  'A train goes 60 mph for 2.5 hours. How far?',
]

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------
interface ParsedResponse {
  answer: string
  steps: string[]
  expression: string
  category: string
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  parsed?: ParsedResponse
  isError?: boolean
}

// -------------------------------------------------------------------
// Main Page
// -------------------------------------------------------------------
export default function Page() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({})

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSessionId(generateUUID())
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const toggleSteps = useCallback((id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || isLoading) return

    const userMsg: Message = { id: generateUUID(), role: 'user', content: msg }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const result = await callAIAgent(msg, AGENT_ID, { session_id: sessionId })
      const agentId = generateUUID()

      if (result.success) {
        let parsed = result?.response?.result
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch {
            parsed = { answer: parsed, steps: [], expression: '', category: '' }
          }
        }

        setMessages((prev) => [...prev, {
          id: agentId,
          role: 'agent',
          content: parsed?.answer ?? '',
          parsed: {
            answer: parsed?.answer ?? '',
            steps: Array.isArray(parsed?.steps) ? parsed.steps : [],
            expression: parsed?.expression ?? '',
            category: parsed?.category ?? '',
          },
        }])
      } else {
        setMessages((prev) => [...prev, {
          id: agentId,
          role: 'agent',
          content: result?.error ?? 'Something went wrong. Try again.',
          isError: true,
        }])
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: generateUUID(),
        role: 'agent',
        content: 'Something went wrong. Try again.',
        isError: true,
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [input, isLoading, sessionId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const isEmpty = messages.length === 0

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-neutral-50 p-4">
    <div className="w-full max-w-xl h-full max-h-[700px] flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">

      {/* Header */}
      <header className="flex-shrink-0 px-5 py-4 border-b border-neutral-200">
        <h1 className="text-base font-semibold text-neutral-900 tracking-tight">Calculator</h1>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {isEmpty && !isLoading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-5">
            <p className="text-sm text-neutral-400 mb-6">Type any math problem</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs text-neutral-500 border border-neutral-200 rounded-full px-3 py-1.5 hover:bg-neutral-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-5 py-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  /* User bubble */
                  <div className="flex justify-end">
                    <div className="bg-neutral-900 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ) : msg.isError ? (
                  /* Error */
                  <div className="text-sm text-red-500">{msg.content}</div>
                ) : (
                  /* Agent bubble */
                  <div className="max-w-[85%] space-y-2">
                    {/* Expression */}
                    {msg.parsed?.expression && (
                      <p className="font-mono text-xs text-neutral-400">{msg.parsed.expression}</p>
                    )}

                    {/* Answer */}
                    <p className="text-xl font-semibold text-neutral-900">
                      {msg.parsed?.answer || msg.content}
                    </p>

                    {/* Steps toggle */}
                    {Array.isArray(msg.parsed?.steps) && msg.parsed.steps.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleSteps(msg.id)}
                          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          {expandedSteps[msg.id] ? (
                            <FiChevronUp className="w-3 h-3" />
                          ) : (
                            <FiChevronDown className="w-3 h-3" />
                          )}
                          Steps
                        </button>
                        {expandedSteps[msg.id] && (
                          <ol className="mt-2 space-y-1 text-sm text-neutral-600">
                            {msg.parsed.steps.map((step, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-neutral-300 text-xs mt-0.5">{i + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {isLoading && (
              <div className="flex items-center gap-1 py-2">
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-neutral-200 px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a math problem..."
            disabled={isLoading}
            className="flex-1 h-10 px-4 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-neutral-900 text-white disabled:opacity-30 transition-opacity"
            aria-label="Send"
          >
            <FiSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}

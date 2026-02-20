'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { cn, generateUUID } from '@/lib/utils'
import { FiSend, FiPlus, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { RiCalculatorLine } from 'react-icons/ri'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { Switch } from '@/components/ui/switch'

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------
const AGENT_ID = '6998bfc611c834a827fbb621'

const THEME_VARS = {
  '--background': '0 0% 100%',
  '--foreground': '0 0% 9%',
  '--card': '0 0% 99%',
  '--card-foreground': '0 0% 9%',
  '--primary': '0 0% 9%',
  '--primary-foreground': '0 0% 98%',
  '--secondary': '0 0% 96%',
  '--secondary-foreground': '0 0% 9%',
  '--accent': '0 0% 92%',
  '--accent-foreground': '0 0% 9%',
  '--muted': '0 0% 94%',
  '--muted-foreground': '0 0% 45%',
  '--border': '0 0% 90%',
  '--input': '0 0% 85%',
  '--destructive': '0 84% 60%',
  '--ring': '0 0% 9%',
  '--radius': '0.875rem',
} as React.CSSProperties

const SAMPLE_MESSAGES: Array<{ role: 'user' | 'agent'; content: string; parsed?: ParsedResponse }> = [
  {
    role: 'user',
    content: 'What is 15% of 240?',
  },
  {
    role: 'agent',
    content: '',
    parsed: {
      answer: '36',
      steps: [
        'Convert 15% to a decimal: 15 / 100 = 0.15',
        'Multiply by 240: 0.15 x 240 = 36',
        'Therefore, 15% of 240 is 36.',
      ],
      expression: '15% * 240',
      category: 'percentage',
    },
  },
  {
    role: 'user',
    content: 'Solve for x: 2x + 5 = 17',
  },
  {
    role: 'agent',
    content: '',
    parsed: {
      answer: 'x = 6',
      steps: [
        'Start with the equation: 2x + 5 = 17',
        'Subtract 5 from both sides: 2x = 12',
        'Divide both sides by 2: x = 6',
        'Verify: 2(6) + 5 = 12 + 5 = 17. Correct!',
      ],
      expression: '2x + 5 = 17',
      category: 'algebra',
    },
  },
  {
    role: 'user',
    content: 'Convert 72 degrees Fahrenheit to Celsius',
  },
  {
    role: 'agent',
    content: '',
    parsed: {
      answer: '22.22 degrees Celsius',
      steps: [
        'Use the formula: C = (F - 32) x 5/9',
        'Substitute F = 72: C = (72 - 32) x 5/9',
        'Simplify: C = 40 x 5/9',
        'Calculate: C = 200/9 = 22.22 (rounded to 2 decimal places)',
      ],
      expression: '(72 - 32) * 5/9',
      category: 'unit conversion',
    },
  },
]

const SUGGESTION_CHIPS = [
  { label: 'Percentage calc', query: 'What is 25% of 380?' },
  { label: 'Unit conversion', query: 'Convert 5 miles to kilometers' },
  { label: 'Solve equation', query: 'Solve for x: 3x - 7 = 20' },
  { label: 'Word problem', query: 'If a train travels at 60 mph for 2.5 hours, how far does it go?' },
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
// Markdown renderer (for potential markdown in answers)
// -------------------------------------------------------------------
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------------
// ErrorBoundary
// -------------------------------------------------------------------
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// -------------------------------------------------------------------
// TypingIndicator component
// -------------------------------------------------------------------
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 md:px-6 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
        <RiCalculatorLine className="w-4 h-4 text-foreground" />
      </div>
      <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-2xl rounded-tl-sm px-4 py-3 shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// AgentMessage component
// -------------------------------------------------------------------
function AgentMessage({
  message,
  isStepsExpanded,
  onToggleSteps,
}: {
  message: Message
  isStepsExpanded: boolean
  onToggleSteps: () => void
}) {
  const parsed = message.parsed
  const steps = Array.isArray(parsed?.steps) ? parsed.steps : []
  const answer = parsed?.answer ?? ''
  const expression = parsed?.expression ?? ''
  const category = parsed?.category ?? ''

  if (message.isError) {
    return (
      <div className="flex items-start gap-3 px-4 md:px-6 py-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <RiCalculatorLine className="w-4 h-4 text-foreground" />
        </div>
        <div className="backdrop-blur-[16px] bg-white/75 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md max-w-[85%] md:max-w-[70%]">
          <p className="text-sm text-destructive">
            {message.content || 'Something went wrong. Please try again.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 md:px-6 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
        <RiCalculatorLine className="w-4 h-4 text-foreground" />
      </div>
      <div className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] rounded-2xl rounded-tl-sm px-4 py-4 shadow-md max-w-[85%] md:max-w-[70%] space-y-3">
        {/* Category badge */}
        {category && (
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-medium">
            {category}
          </Badge>
        )}

        {/* Expression */}
        {expression && (
          <div className="bg-secondary/60 rounded-lg px-3 py-2">
            <code className="font-mono text-sm text-foreground">{expression}</code>
          </div>
        )}

        {/* Answer - prominent */}
        {answer && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground mb-1">Answer</p>
            <p className="text-lg font-bold text-foreground">{answer}</p>
          </div>
        )}

        {/* If no parsed data, render the raw content as markdown */}
        {!answer && !expression && message.content && (
          <div className="text-sm text-foreground">
            {renderMarkdown(message.content)}
          </div>
        )}

        {/* Steps toggle */}
        {steps.length > 0 && (
          <div className="border-t border-border pt-2">
            <button
              onClick={onToggleSteps}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {isStepsExpanded ? (
                <FiChevronUp className="w-3.5 h-3.5" />
              ) : (
                <FiChevronDown className="w-3.5 h-3.5" />
              )}
              <span>{isStepsExpanded ? 'Hide Steps' : 'Show Steps'} ({steps.length})</span>
            </button>
            {isStepsExpanded && (
              <ol className="mt-2 space-y-1.5 pl-1">
                {steps.map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-foreground/80">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary text-[10px] font-semibold flex items-center justify-center text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5">{formatInline(step)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// UserMessage component
// -------------------------------------------------------------------
function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end px-4 md:px-6 py-3">
      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-md max-w-[85%] md:max-w-[70%]">
        <p className="text-sm">{message.content}</p>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// EmptyState component
// -------------------------------------------------------------------
function EmptyState({ onSuggestionClick }: { onSuggestionClick: (query: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-5 shadow-sm">
        <RiCalculatorLine className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">AI Calculator</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-8">
        Ask me any math problem -- from simple arithmetic to complex equations
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {SUGGESTION_CHIPS.map((chip) => (
          <Button
            key={chip.label}
            variant="secondary"
            size="sm"
            className="rounded-full text-xs px-4 py-2 h-auto hover:bg-accent transition-colors shadow-sm"
            onClick={() => onSuggestionClick(chip.query)}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// AgentStatusSection component
// -------------------------------------------------------------------
function AgentStatusSection({ activeAgentId, isLoading }: { activeAgentId: string | null; isLoading: boolean }) {
  return (
    <div className="px-4 md:px-6 pb-2">
      <div className="backdrop-blur-[16px] bg-white/75 border border-border rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-2 h-2 rounded-full", isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
            <span className="text-xs font-medium text-foreground">Calculator Agent</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{AGENT_ID.slice(0, 8)}...</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {isLoading ? 'Processing calculation...' : 'Solves arithmetic, algebra, unit conversions, and word problems'}
        </p>
      </div>
    </div>
  )
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
  const [showSampleData, setShowSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Generate sessionId on mount
  useEffect(() => {
    setSessionId(generateUUID())
  }, [])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const toggleSteps = useCallback((messageId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [messageId]: !prev[messageId] }))
  }, [])

  const handleNewConversation = useCallback(() => {
    setMessages([])
    setExpandedSteps({})
    setInput('')
    setSessionId(generateUUID())
    setActiveAgentId(null)
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || isLoading) return

    const userMsgId = generateUUID()
    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setActiveAgentId(AGENT_ID)

    try {
      const result = await callAIAgent(text, AGENT_ID, { session_id: sessionId })

      const agentMsgId = generateUUID()

      if (result.success) {
        let parsed = result?.response?.result
        // Handle case where result might be a string
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed)
          } catch {
            // If it's a plain text response, wrap it
            parsed = { answer: parsed, steps: [], expression: '', category: '' }
          }
        }

        const answer = parsed?.answer ?? ''
        const steps = Array.isArray(parsed?.steps) ? parsed.steps : []
        const expression = parsed?.expression ?? ''
        const category = parsed?.category ?? ''

        const agentMessage: Message = {
          id: agentMsgId,
          role: 'agent',
          content: answer,
          parsed: {
            answer,
            steps,
            expression,
            category,
          },
        }

        setMessages((prev) => [...prev, agentMessage])
      } else {
        const errorMessage: Message = {
          id: agentMsgId,
          role: 'agent',
          content: result?.error ?? 'Something went wrong. Please try again.',
          isError: true,
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch {
      const errorMsgId = generateUUID()
      const errorMessage: Message = {
        id: errorMsgId,
        role: 'agent',
        content: 'Something went wrong. Please try again.',
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
      inputRef.current?.focus()
    }
  }, [input, isLoading, sessionId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleSuggestionClick = useCallback(
    (query: string) => {
      handleSend(query)
    },
    [handleSend]
  )

  // Determine which messages to display
  const displayMessages = showSampleData && messages.length === 0
    ? SAMPLE_MESSAGES.map((m, idx) => ({
        id: `sample-${idx}`,
        role: m.role,
        content: m.content,
        parsed: m.parsed,
      }))
    : messages

  const showEmptyState = displayMessages.length === 0

  return (
    <ErrorBoundary>
      <div
        style={THEME_VARS}
        className="min-h-screen flex flex-col bg-background text-foreground"
      >
        {/* Gradient background overlay */}
        <div className="fixed inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, hsl(0 0% 99%) 0%, hsl(210 10% 98%) 35%, hsl(0 0% 98%) 70%, hsl(220 8% 99%) 100%)' }} />

        {/* Content wrapper */}
        <div className="relative z-10 flex flex-col h-screen max-h-screen">

          {/* ---- Header ---- */}
          <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-border backdrop-blur-[16px] bg-white/75">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <RiCalculatorLine className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">AI Calculator</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Sample Data toggle */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground select-none" htmlFor="sample-toggle">
                  Sample Data
                </label>
                <Switch
                  id="sample-toggle"
                  checked={showSampleData}
                  onCheckedChange={setShowSampleData}
                />
              </div>
              {/* New Conversation */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewConversation}
                className="h-8 w-8 rounded-lg"
                aria-label="New Conversation"
              >
                <FiPlus className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* ---- Chat area ---- */}
          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            {showEmptyState ? (
              <EmptyState onSuggestionClick={handleSuggestionClick} />
            ) : (
              <div className="py-4">
                {displayMessages.map((msg) => {
                  if (msg.role === 'user') {
                    return <UserMessage key={msg.id} message={msg} />
                  }
                  return (
                    <AgentMessage
                      key={msg.id}
                      message={msg}
                      isStepsExpanded={!!expandedSteps[msg.id]}
                      onToggleSteps={() => toggleSteps(msg.id)}
                    />
                  )
                })}
                {isLoading && <TypingIndicator />}
              </div>
            )}
          </div>

          {/* ---- Agent Status ---- */}
          <AgentStatusSection activeAgentId={activeAgentId} isLoading={isLoading} />

          {/* ---- Input Bar ---- */}
          <div className="flex-shrink-0 border-t border-border px-4 md:px-6 py-4 backdrop-blur-[16px] bg-white/75">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a math problem..."
                  disabled={isLoading}
                  className="w-full h-11 px-4 pr-12 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                />
              </div>
              <Button
                size="icon"
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="h-11 w-11 rounded-xl shadow-md flex-shrink-0"
                aria-label="Send"
              >
                <FiSend className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

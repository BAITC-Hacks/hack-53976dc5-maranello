export type Level = 'draft' | 'workable' | 'ready' | 'priority'
export type Role = 'business' | 'student'
export type CardField = 'title' | 'context' | 'need' | 'users' | 'data_materials' | 'constraints' | 'expected_result' | 'success_criteria' | 'contact' | 'interaction_format'
export type Card = Record<CardField, string>
export interface Rating {
  score: number
  level: Level
  breakdown: { key: string; score: number; max_score: number; fields: CardField[]; missing_fields: CardField[] }[]
  missing_fields: CardField[]
  recommendations: string[]
}
export interface Task extends Card {
  id: number
  topic: string
  description: string
  status: 'draft' | 'confirmed' | 'published'
  answers: Partial<Card>
  rating: Rating
  created_at: string
  updated_at: string
  published_at: string | null
  ai_analysis: { provider: 'mock' | 'openai' | 'fallback' | 'legacy'; fallback_reason: string | null }
}
export interface Questions {
  task_id: number
  missing_fields: CardField[]
  questions: { field: CardField; question: string }[]
  ai_analysis: Task['ai_analysis']
}
export interface ProposalInput {
  team_name: string
  solution_idea: string
  plan: string
  estimated_duration: string
  prototype_url: string
  contact: string
}
export interface Proposal extends ProposalInput {
  id: number
  task_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  decided_at: string | null
}

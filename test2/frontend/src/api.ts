import type { Card, CardField, Level, Proposal, ProposalInput, Questions, Task } from './types'

const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message) }
}
const translations: Record<string, string> = {
  'Task not found': 'Задача не найдена. Возможно, она была удалена.',
  'Proposal not found': 'Предложение не найдено.',
  'Confirm the card before publishing': 'Сначала подтвердите карточку задачи.',
  'Submit at least three distinct clarification answers first': 'Сначала ответьте на три уточняющих вопроса.',
  'Only one proposal can be accepted per task': 'Для этой задачи уже выбрана команда. Обновите предложения.',
  'The proposal decision is final in this MVP': 'По этому предложению уже принято окончательное решение.',
  'Published tasks cannot be edited in this MVP': 'Опубликованную задачу больше нельзя редактировать.',
  'Proposals are only available for published tasks': 'Предложения доступны после публикации задачи.',
}
async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${base}${path}`, {
      method, signal: controller.signal,
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = body?.detail
      throw new ApiError(typeof detail === 'string' ? (translations[detail] || detail)
        : response.status === 422 ? 'Проверьте обязательные поля, длину текста и формат ссылки.'
        : 'Сервис временно недоступен. Попробуйте ещё раз.', response.status)
    }
    if (body === null) throw new ApiError('Сервер вернул пустой ответ. Повторите запрос.')
    return body as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error instanceof DOMException && error.name === 'AbortError'
      ? 'Ответ занимает больше времени, чем обычно. Попробуйте ещё раз.'
      : 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.')
  } finally { window.clearTimeout(timeout) }
}
export type CatalogParams = { sort?: string; topic?: string; level?: Level | ''; offset?: number; limit?: number }
export const api = {
  tasks: (params: CatalogParams = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { if (value !== '' && value !== undefined) query.set(key, String(value)) })
    return request<Task[]>(`/tasks?${query}`)
  },
  task: (id: number) => request<Task>(`/tasks/${id}`),
  createTask: (description: string, topic: string) => request<Task>('/tasks', 'POST', { description, topic }),
  questions: (id: number) => request<Questions>(`/tasks/${id}/questions`),
  answer: (id: number, answers: { field: CardField; answer: string }[]) => request<Task>(`/tasks/${id}/answers`, 'POST', { answers }),
  edit: (id: number, card: Partial<Card> & { topic?: string }) => request<Task>(`/tasks/${id}`, 'PATCH', card),
  confirm: (id: number) => request<Task>(`/tasks/${id}/confirm`, 'POST'),
  publish: (id: number) => request<Task>(`/tasks/${id}/publish`, 'POST'),
  proposals: (id: number, offset = 0) => request<Proposal[]>(`/tasks/${id}/proposals?limit=100&offset=${offset}`),
  propose: (id: number, proposal: ProposalInput) => request<Proposal>(`/tasks/${id}/proposals`, 'POST', proposal),
  decide: (id: number, status: 'accepted' | 'rejected') => request<Proposal>(`/proposals/${id}`, 'PATCH', { status }),
}
export async function allTasks() {
  const result: Task[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await api.tasks({ limit: 100, offset })
    result.push(...page)
    if (page.length < 100) return result
  }
}
export async function allProposals(id: number) {
  const result: Proposal[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await api.proposals(id, offset)
    result.push(...page)
    if (page.length < 100) return result
  }
}

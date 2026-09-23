import { test, expect, type Page } from '@playwright/test'
import type { Proposal, Task } from '../src/types'

const task: Task = {
  id: 9101, title: 'Надёжный реестр заявок', topic: 'автоматизация',
  description: 'Заявки мастерской теряются в чатах', context: 'Мастерская',
  need: 'Собрать заявки в реестре', users: '', data_materials: '', constraints: '',
  expected_result: 'Рабочий реестр', success_criteria: 'Заявки доступны по номеру',
  contact: '', interaction_format: '', status: 'published',
  answers: { need: 'Собрать заявки в реестре', expected_result: 'Рабочий реестр', success_criteria: 'Заявки доступны по номеру' },
  rating: { score: 50, level: 'workable', breakdown: [], missing_fields: [], recommendations: [] },
  created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z', published_at: '2026-09-23T10:00:00Z',
  ai_analysis: { provider: 'mock', fallback_reason: null },
}
const proposal: Proposal = {
  id: 1, task_id: task.id, team_name: 'Команда реестра', solution_idea: 'Создадим реестр',
  plan: 'Настроим поиск', estimated_duration: '5 часов', prototype_url: '', contact: '',
  status: 'pending', created_at: task.created_at, decided_at: null,
}

async function mockTask(page: Page, value = task) {
  await page.route('**/api/tasks?*', route => route.fulfill({ json: [value] }))
  await page.route(`**/api/tasks/${task.id}`, route => route.fulfill({ json: value }))
}

test('proposal counts recover after a failed request when the catalog is reopened', async ({ page }) => {
  await mockTask(page)
  let failed = true
  await page.route(`**/api/tasks/${task.id}/proposals?*`, route => failed
    ? route.abort()
    : route.fulfill({ json: [proposal] }))
  await page.goto('/catalog')
  await expect(page.locator('.task-card')).toContainText('Отклики не загружены')
  failed = false
  await page.getByRole('link', { name: 'Обзор', exact: true }).click()
  await page.getByRole('link', { name: 'Каталог задач', exact: true }).click()
  await expect(page.locator('.task-card')).toContainText('1 предложение')
})

test('a forced count refresh is preserved while an earlier request is pending', async ({ page }) => {
  await mockTask(page)
  let releaseFirst!: () => void
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve })
  let requests = 0
  await page.route(`**/api/tasks/${task.id}/proposals?*`, async route => {
    const requestNumber = ++requests
    if (requestNumber === 1) await firstResponse
    await route.fulfill({ json: requestNumber === 1 ? [] : [proposal] })
  })
  await page.goto('/catalog')
  await expect.poll(() => requests).toBe(1)
  await page.locator('.task-card').click()
  await expect(page.getByRole('heading', { name: task.title, exact: true })).toBeVisible()
  releaseFirst()
  await expect(page.locator('.detail-status')).toContainText('1 предложение')
  expect(requests).toBe(2)
})

test('invalid saved drafts do not crash intake, questions, editor or proposal forms', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mockTask(page, { ...task, status: 'draft', published_at: null })
  await page.route(`**/api/tasks/${task.id}/proposals?*`, route => route.fulfill({ json: [] }))
  await page.route(`**/api/tasks/${task.id}/questions`, route => route.fulfill({ json: {
    task_id: task.id, missing_fields: ['need', 'expected_result', 'success_criteria'],
    questions: [
      { field: 'need', question: 'Какую проблему нужно решить?' },
      { field: 'expected_result', question: 'Какой конкретный результат должна предоставить команда?' },
      { field: 'success_criteria', question: 'Как вы проверите, что задача решена успешно?' },
    ], ai_analysis: task.ai_analysis,
  } }))
  await page.addInitScript(({ id, updated }) => {
    localStorage.setItem('praktika-description', 'null')
    localStorage.setItem(`praktika-answers-${id}`, 'null')
    localStorage.setItem(`praktika-editor-${id}`, JSON.stringify({ updated, values: null }))
    localStorage.setItem(`praktika-proposal-${id}`, JSON.stringify({ team_name: 123, solution_idea: 'Старая идея' }))
  }, { id: task.id, updated: task.updated_at })
  await page.goto('/tasks/new')
  await expect(page.getByLabel('Опишите задачу или проблему')).toHaveValue('')
  await page.getByLabel('Опишите задачу или проблему').fill('Новая задача')
  await expect(page.getByRole('button', { name: 'Разобрать задачу' })).toBeEnabled()
  await page.goto(`/tasks/${task.id}/questions`)
  await expect(page.getByLabel('Какую проблему нужно решить?')).toHaveValue(task.answers.need!)
  await page.goto(`/tasks/${task.id}/edit`)
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(task.title)
  await page.route(`**/api/tasks/${task.id}`, route => route.fulfill({ json: task }))
  await page.goto(`/tasks/${task.id}/propose`)
  await page.getByRole('button', { name: 'Переключиться на команду' }).click()
  await expect(page.getByLabel('Название команды')).toHaveValue('')
  await expect(page.getByLabel('Идея решения')).toHaveValue('')
  await page.getByLabel('Название команды').fill('Новая команда')
  await expect(page.getByRole('button', { name: 'Отправить предложение' })).toBeEnabled()
  expect(errors).toEqual([])
})

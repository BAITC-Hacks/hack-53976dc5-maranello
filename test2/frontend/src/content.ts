import type { CardField, Level, Task } from './types'

export const fields: { key: CardField; label: string; hint: string }[] = [
  { key: 'title', label: 'Название', hint: 'Коротко и по делу: что нужно сделать?' },
  { key: 'context', label: 'Контекст', hint: 'Как устроен процесс сейчас и где возникает проблема?' },
  { key: 'need', label: 'Потребность', hint: 'Что хотите изменить или улучшить?' },
  { key: 'users', label: 'Пользователи', hint: 'Для кого вы создаёте решение?' },
  { key: 'data_materials', label: 'Данные и материалы', hint: 'Какие таблицы, документы или примеры можно передать команде?' },
  { key: 'constraints', label: 'Ограничения', hint: 'Сроки, технологии, бюджет и другие условия.' },
  { key: 'expected_result', label: 'Ожидаемый результат', hint: 'Какой результат вы хотите получить от команды?' },
  { key: 'success_criteria', label: 'Критерии успеха', hint: 'Как вы поймёте, что задача решена?' },
  { key: 'contact', label: 'Контакт', hint: 'Email, Telegram или другой способ связи.' },
  { key: 'interaction_format', label: 'Формат взаимодействия', hint: 'Как часто и в каком формате вы готовы общаться?' },
]
export const labels = Object.fromEntries(fields.map(field => [field.key, field.label])) as Record<CardField, string>
export const levels: Record<Level, { label: string }> = {
  draft: { label: 'Мало деталей' },
  workable: { label: 'Часть описана' },
  ready: { label: 'Много деталей' },
  priority: { label: 'Подробное описание' },
}
export const componentLabels: Record<string, string> = {
  context_need: 'Контекст и потребность', data_materials: 'Данные и материалы',
  expected_result: 'Ожидаемый результат', success_criteria: 'Критерии успеха',
  constraints: 'Ограничения', users: 'Пользователи', contact_interaction: 'Контакт и взаимодействие',
}
export const titleOf = (task: Task) => task.title || task.need || task.description || `Задача №${task.id}`
export const topicOf = (task: Task) => task.topic || 'Тема не указана'
export function plural(count: number, words: [string, string, string]) {
  const n = Math.abs(count) % 100, m = n % 10
  return `${count} ${n > 10 && n < 20 ? words[2] : m === 1 ? words[0] : m >= 2 && m <= 4 ? words[1] : words[2]}`
}
export const proposalCount = (count: number) => plural(count, ['предложение', 'предложения', 'предложений'])
export const formatDate = (value: string) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date(value))

export const meta = {
  name: 'v4-sync-route-3',
  description: 'Сбор межраздельных правок v4 по частям заметок (3 агента) и проверка согласованности имён между участками (1 агент)',
  phases: [{ title: 'Route', detail: '3 сборщика по частям заметок + 1 сверка имён' }],
}
const A = args
const ITEM = { type: 'object', properties: {
  target: { type: 'string', enum: A.ids, description: 'участок, в файле которого вносится правка' },
  from: { type: 'string', description: 'участок-источник требования' },
  what: { type: 'string', description: 'что поправить (место в целевом файле, по возможности с цитатой)' },
  edit: { type: 'string', description: 'точная правка' },
  reason: { type: 'string', description: 'почему (пункт ядра v4 / соглашений / книга со строками)' },
}, required: ['target', 'from', 'what', 'edit', 'reason'] }
const SCHEMA = { type: 'object', properties: {
  items: { type: 'array', items: ITEM },
  sogl_changes: { type: 'array', items: { type: 'object', properties: { rule: { type: 'string' }, change: { type: 'string' }, reason: { type: 'string' } }, required: ['rule', 'change', 'reason'] } },
  needs_decision: { type: 'array', items: { type: 'string' }, description: 'вопросы, которые правкой участка не решить (выбор между вариантами для всего текста)' },
  report_path: { type: 'string' },
}, required: ['items', 'sogl_changes', 'needs_decision', 'report_path'] }

async function call(prompt, opts) {
  let r = await agent(prompt, opts)
  if (!r) r = await agent(prompt, { ...opts, label: `${opts.label}:retry` })
  return r
}

const BASE = `Проект: конспект по разведывательному анализу, метод изложения v4 (ядро ${A.method}, режим А ${A.mode}), соглашения проекта ${A.sogl}. Текст — файлы участков ${A.wdir}/<id>.md (id: ${A.ids.join(', ')}), собранный текст ${A.assembled}; служебные списки участков ${A.outdir}/service_<id>.md.`
const SKIP = `Правки, адресованные DESIGN или REGISTRY (черновые файлы проекта), не включай: они не часть текста. Предложение переименовать третью категорию «суждение» в «оценку» уже решено: НЕ переименовывать — не включай.`

const jobs = A.chunks.map((c, i) => () => call(`${BASE}
Правщики участков ${c.ids.join(', ')} могли править только свой файл, поэтому правки, нужные в ДРУГИХ участках (и в соглашениях), они записали в заметках ${c.file} (прочитай целиком, по частям) — ищи разделы «Правки в других участках», «не вносил», «нужно согласовать», «SAPP», «Приложение А», «S15», «служебный список» и т. п.
ЗАДАЧА:
1) Собери ВСЕ такие межраздельные правки из этих заметок. Для каждой — целевой участок (target), источник требования (from), место в целевом файле (прочитай целевой файл и проверь, что правка там ещё нужна — часть могла быть уже сделана; проверь и сам участок-источник: формулировка, к которой надо привести, должна стоять там сейчас). Правку, которая уже не нужна, не включай. ${SKIP}
2) Записи для служебных списков: если заметка правщика просит что-то записать в служебный список своего или чужого участка (предпосылка, построенный вывод, непостроенный вывод, исключённое, расхождение, новые места книги), — правка с target = этот участок и what, начинающимся словами «служебный список:».
3) Изменения соглашений (sogl_changes) — если правщик заменил имя из V7 или решил то, что затрагивает весь текст.
4) Вопросы, которые правкой одного участка не решить, — в needs_decision (с вариантами и рекомендацией по ядру v4).
Никакие файлы участков не редактируй. Запиши отчёт в ${A.outdir}/${A.report_prefix}_${i + 1}.md и верни результат по схеме.`, { label: `route:chunk${i + 1}`, phase: 'Route', schema: SCHEMA, effort: 'medium' }))

jobs.push(() => call(`${BASE}
ТЫ — СВЕРЩИК ИМЁН между участками (после прохода правок, в котором участки правились независимо).
ЗАДАЧА: согласованность имён и определений между участками. Для каждой закономерности (таблица V7 соглашений), каждой формы ошибки, каждого вида и каждого термина реестра (Приложение А — ${A.wdir}/SAPP.md) сравни, как он назван и определён в участке, где введён, и во всех остальных участках и в Приложении А (Grep по ${A.wdir}/*.md). Каждое расхождение — правка в целевой участок (target) к имени и определению из участка, где объект введён (from). Особое внимание: строки Приложения А должны совпадать по объёму, параметрам и категории с определениями в тексте (определения в участках только что правились); §15 (S15) пересказывает цепочку теми же именами; §16 (S16) употребляет имена так, как они введены. ${SKIP}
Изменения V7 и других пунктов соглашений, которых требует текущий текст, — в sogl_changes. Вопросы для всего текста — в needs_decision.
Никакие файлы участков не редактируй. Запиши отчёт в ${A.outdir}/${A.report_prefix}_names.md и верни результат по схеме.`, { label: 'route:names', phase: 'Route', schema: SCHEMA, effort: 'medium' }))

const rs = await parallel(jobs)
const ok = rs.filter(Boolean)
const items = [], sogl = [], dec = []
ok.forEach(r => { items.push(...r.items); sogl.push(...r.sogl_changes); dec.push(...r.needs_decision) })
const byTarget = {}
items.forEach(i => { byTarget[i.target] = (byTarget[i.target] || 0) + 1 })
log(`Агентов ${ok.length}/${jobs.length}; межраздельных правок ${items.length}; по адресатам ${JSON.stringify(byTarget)}; правок соглашений ${sogl.length}; вопросов ${dec.length}`)
return { complete: ok.length === jobs.length, items, sogl_changes: sogl, needs_decision: dec, reports: ok.map(r => r.report_path) }

export const meta = {
  name: 'v4-sync-mini',
  description: 'Сбор межраздельных правок из заметок правщиков одного прохода и их внесение по участкам-адресатам',
  phases: [
    { title: 'Route', detail: 'один сборщик: правки по адресатам' },
    { title: 'Apply', detail: 'правщик на участок-адресат (пачки до 25, последовательно)' },
  ],
}
const A = args
const ITEM = { type: 'object', properties: {
  target: { type: 'string', enum: A.ids, description: 'участок, в файле которого вносится правка' },
  from: { type: 'string', description: 'участок-источник требования' },
  what: { type: 'string', description: 'что поправить (место в целевом файле, по возможности с цитатой); для служебного списка — начинать словами «служебный список:»' },
  edit: { type: 'string', description: 'точная правка' },
  reason: { type: 'string', description: 'почему (пункт ядра v4 / соглашений / книга со строками)' },
}, required: ['target', 'from', 'what', 'edit', 'reason'] }
const ROUTE = { type: 'object', properties: {
  items: { type: 'array', items: ITEM },
  needs_decision: { type: 'array', items: { type: 'string' } },
}, required: ['items', 'needs_decision'] }
const SUMMARY = { type: 'object', properties: { applied: { type: 'number' }, skipped: { type: 'number' }, notes: { type: 'string' } }, required: ['applied', 'skipped', 'notes'] }
const EFF = 'medium'

async function call(prompt, opts) {
  let r = await agent(prompt, opts)
  if (!r) r = await agent(prompt, { ...opts, label: `${opts.label}:retry` })
  return r
}

const BASE = `Проект: конспект по разведывательному анализу, метод изложения v4 (ядро ${A.method} — прочитай; режим А ${A.mode}); соглашения проекта ${A.sogl} — прочитай целиком (V11 важнее V10); основной источник и посылки — ${A.main_source}. Книги: ${A.books}. Файлы участков: ${A.wdir}/<id>.md (id: ${A.ids.join(', ')}); служебные списки — ${A.outdir}/service_<id>.md.`

phase('Route')
const r = await call(`${BASE}
ТЫ — СБОРЩИК межраздельных правок прохода ${A.tag}. Правщики участков могли править только свои файлы, поэтому правки, нужные в ДРУГИХ участках, они записали в заметках ${A.notes} (прочитай целиком).
Собери ВСЕ такие правки. Для каждой — target, from, место в целевом файле (прочитай целевой файл и проверь, что правка там ещё нужна; прочитай и участок-источник: формулировка, к которой надо привести, должна стоять там сейчас), точная правка, причина. Уже внесённое не включай. Правки DESIGN/REGISTRY не включай. Вопросы, которые правкой одного участка не решить, — в needs_decision (с вариантами и рекомендацией по ядру v4).
Никакие файлы не редактируй. Верни результат по схеме.`, { label: `route:${A.tag}`, phase: 'Route', schema: ROUTE, effort: EFF })
if (!r) return { tag: A.tag, complete: false, note: 'сборщик не вернул результат' }
const items = r.items.map((x, i) => ({ ...x, idx: i }))
const byT = {}
items.forEach(x => { (byT[x.target] = byT[x.target] || []).push(x) })
log(`${A.tag}: межраздельных правок ${items.length}; по адресатам ${JSON.stringify(Object.fromEntries(Object.entries(byT).map(([k, v]) => [k, v.length])))}; вопросов ${r.needs_decision.length}`)

const units = Object.entries(byT).map(([id, list]) => {
  const batches = []
  for (let i = 0; i < list.length; i += 25) batches.push(list.slice(i, i + 25))
  return { id, batches }
})
const results = await pipeline(units, async (u) => {
  const out = []
  for (let b = 0; b < u.batches.length; b++) {
    const fx = await call(`${BASE}
ТЫ — ПРАВЩИК участка ${u.id}, файлы ${A.wdir}/${u.id}.md и ${A.outdir}/service_${u.id}.md (согласование после прохода ${A.tag}, пачка ${b + 1} из ${u.batches.length}).
${b === 0 ? `СНАЧАЛА: cp ${A.wdir}/${u.id}.md ${A.wdir}/_bak/${u.id}_${A.tag}s.md` : 'Предыдущие пачки уже внесены.'}
Внеси межраздельные правки, адресованные этому участку. Перед каждой прочитай место в своём файле и в участке-источнике (from): если правка уже внесена, противоречит ядру v4 или соглашениям (V11 важнее записи) — пропусти и назови причину. Каждая правка — минимальная и сама удовлетворяет ядру v4 (статус по связке; одно предложение — один ход; полные термины; определения по V5; данность с атрибуцией и %%src%%; заголовки H2/H3 не менять; ссылки [[#…]] — только на существующие заголовки, проверь Grep'ом по ${A.wdir}). Утверждение о книге — только после сверки по строкам. Записи «служебный список: …» вносятся в разделы 1–4 служебного списка; в его разделе 5 добавь подраздел «Согласование ${A.tag}» — по строке на правку.
Перечитай файлы. Других файлов не редактируй и не создавай (временные скрипты тоже). Если правка требует изменения ещё одного участка — запиши в notes.
ПРАВКИ: ${JSON.stringify(u.batches[b])}
Верни сводку по схеме.`, { label: `sync:${u.id}:${A.tag}:b${b + 1}`, phase: 'Apply', schema: SUMMARY, effort: EFF })
    if (!fx) return { id: u.id, status: 'incomplete', done_batches: b, out }
    out.push({ batch: b + 1, ...fx })
  }
  log(`${u.id}: внесено ${out.reduce((s, x) => s + x.applied, 0)}, пропущено ${out.reduce((s, x) => s + x.skipped, 0)}`)
  return { id: u.id, status: 'done', out }
})
return { tag: A.tag, items, needs_decision: r.needs_decision, done: results.filter(Boolean) }

export const meta = {
  name: 'v4-sync-apply-2',
  description: 'Межраздельные правки v4 (по пачкам, последовательно внутри участка) и приведение участка к решениям V11 соглашений',
  phases: [{ title: 'Apply', detail: 'правщик участка: пачки межраздельных правок, затем сверка с V11' }],
}
const A = args
const SUMMARY = { type: 'object', properties: {
  applied: { type: 'number' }, skipped: { type: 'number' }, notes: { type: 'string' },
}, required: ['applied', 'skipped', 'notes'] }

async function call(prompt, opts) {
  let r = await agent(prompt, opts)
  if (!r) r = await agent(prompt, { ...opts, label: `${opts.label}:retry` })
  return r
}

const BASE = `Проект: конспект по разведывательному анализу, метод изложения v4 (ядро ${A.method} — прочитай; режим А ${A.mode}); соглашения проекта ${A.sogl} — прочитай целиком, ОСОБЕННО новый раздел V11 (решения после прохода v2; при расхождении с V10 действует V11); основной источник и посылки — ${A.main_source}. Книги: ${A.books}. Файлы участков: ${A.wdir}/<id>.md. Заголовки H3 «5.4 Несовместимые сведения», «8.9 Гипотеза без несогласий», «14.7 Дерево сценариев» уже переименованы во всех файлах вместе со ссылками (V11.5, V11.22, V11.27).`
const RULES = `Каждая правка — минимальная и сама удовлетворяет ядру v4 (статус по связке; одно предложение — один ход; полные термины; определения по V5; данность с атрибуцией и %%src%%; заголовки H2/H3 не менять; ссылки [[#…]] — только на существующие заголовки, проверь Grep'ом по ${A.wdir}). Утверждение о книге — только после сверки по её строкам. Правило применяется к тексту, а не механически: меняй только то, где без правки остаётся нарушение.`

function prompt(u, b, nb) {
  const batch = u.batches[b]
  const last = b === nb - 1
  return `${BASE}
ТЫ — ПРАВЩИК участка ${u.id}, файлы ${A.wdir}/${u.id}.md и ${A.outdir}/service_${u.id}.md (согласование ${A.tag}, пачка ${b + 1} из ${nb}).
${b === 0 ? `СНАЧАЛА: cp ${A.wdir}/${u.id}.md ${A.wdir}/_bak/${u.id}_${A.tag}.md` : 'Предыдущие пачки уже внесены в файл.'}
${batch.length ? `1) Внеси межраздельные правки, адресованные этому участку (файл ${A.items_file}, JSON-массив; записи с idx ${JSON.stringify(batch)}). Перед каждой правкой прочитай место в своём файле и в участке-источнике (from): если правка уже внесена, противоречит ядру v4 или решению V11 — пропусти и назови причину (решение V11 важнее записи).` : '1) Адресованных этому участку межраздельных правок в этой пачке нет.'}
${last ? `2) Затем проверь ВЕСЬ свой файл по решениям V11 соглашений (${A.v11_scope || 'уточнения V10 и пункты 21–49'}): найди каждое место, которое решение затрагивает (Grep по старым формулировкам, названным в решении), и приведи его к решению. Если решение требует правки в другом участке — не правь его, а запиши в notes.` : ''}
${RULES}
В служебный список участка (${A.outdir}/service_${u.id}.md), раздел 5, добавь подраздел «Согласование ${A.tag}» — по строке на правку (что, откуда — запись межраздельных правок или решение V11.N, внесена / пропущена и почему). Записи «служебный список: …» вносятся в соответствующие разделы 1–4 служебного списка.
Перечитай файлы. Других файлов (кроме резервной копии) не редактируй и не создавай. Верни сводку по схеме.`
}

const results = await pipeline(A.units, async (u) => {
  const nb = u.batches.length
  const out = []
  for (let b = 0; b < nb; b++) {
    const r = await call(prompt(u, b, nb), { label: `sync:${u.id}:${A.tag}:b${b + 1}`, phase: 'Apply', schema: SUMMARY, effort: 'medium' })
    if (!r) { log(`${u.id}: пачка ${b + 1}/${nb} не внесена`); return { id: u.id, status: 'incomplete', done_batches: b, batches: nb, out } }
    out.push({ batch: b + 1, ...r })
  }
  const applied = out.reduce((s, x) => s + x.applied, 0), skipped = out.reduce((s, x) => s + x.skipped, 0)
  log(`${u.id}: внесено ${applied}, пропущено ${skipped}`)
  return { id: u.id, status: 'done', applied, skipped, out }
})
const done = results.filter(Boolean)
return { tag: A.tag, done, incomplete: done.filter(d => d.status !== 'done').map(d => d.id) }

export const meta = {
  name: 'audit-v4-fix',
  description: 'Внесение подтверждённых замечаний прохода аудита v4 пачками (последовательно внутри раздела); для раздела без полного голосования — недостающие верификаторы',
  phases: [
    { title: 'Verify', detail: 'недостающие верификаторы (если есть)' },
    { title: 'Fix', detail: 'правщик по пачкам до 20 замечаний' },
  ],
}

const A = args
const TAG = A.tag
const WD = A.wdir
const EFF = 'medium'
const BATCH = 20

const VERIFY_SCHEMA = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
    idx: { type: 'number' }, confirmed: { type: 'boolean' }, duplicate_of: { type: 'number' }, correct_point: { type: 'string' }, refined_fix: { type: 'string' }, reasoning: { type: 'string' },
  }, required: ['idx', 'confirmed', 'duplicate_of', 'correct_point', 'refined_fix', 'reasoning'] } } },
  required: ['verdicts'],
}
const FIX_SUMMARY = { type: 'object', properties: { applied: { type: 'number' }, not_applied: { type: 'number' }, notes: { type: 'string' } }, required: ['applied', 'not_applied', 'notes'] }

const BASE = `Конспект по разведывательному анализу (эмпирический предмет), метод изложения v4.
Ядро метода (прочитай ЦЕЛИКОМ): ${A.method}. Режим А: ${A.mode}. Соглашения проекта (обязательны; раздел V11 — решения по всему тексту, важнее V10): ${A.sogl}. Замечание, которое предлагает отменить решение V10–V11, — нарушение, только если само решение нарушает пункт ядра (назови пункт). Основной источник: ${A.main_source}. Первичные понятия: ${A.primitives}.
Собранный текст (до этого прохода): ${A.assembled}; файлы участков ${WD}/<id>.md. Фиксированный список H2/H3: ${A.design} (§5.6). Книги: ${A.books}.`

const ROLES = {
  strict: 'СТРОГИЙ СУДЬЯ: подтверждай, если пункт ядра v4 действительно нарушен текущим текстом и это не одно из исключений, которые допускает само ядро.',
  advocate: 'АДВОКАТ ТЕКСТА: ищи, почему это НЕ нарушение (исключения ядра; маркер общности; смысл исключает ложное прочтение; неверно прочитанный пункт; устаревшая цитата; вес вместо логики). Если пункт применим не бесспорно — confirmed=false.',
  logic: 'ЛОГИКА ПРОТИВ ВЕСА: подтверждай, только если правка изменит одно из: что из чего следует; статус утверждения; категорию подлежащего; точку отсчёта термина; однозначность раскрытия (антецедент, определение); порядок вопросов; объём понятия; согласие с источником. Если меняется лишь звучание или длина — confirmed=false.',
}
const DISCIPLINE = `Дисциплина (ядро v4, «Как пользоваться»): только с пунктом ядра; вес — не замечание; правило применяется к тексту, а не механически; держи вердикт; то, что ядро допускает, — не нарушение.`

async function call(prompt, opts) {
  let r = await agent(prompt, opts)
  if (!r) r = await agent(prompt, { ...opts, label: `${opts.label}:retry` })
  return r
}

function ctx(u) {
  return `${BASE}
Участок: «${u.title}» (${u.contract}). Файл участка: ${WD}/${u.id}.md. Соседи: ${u.prev ? WD + '/' + u.prev + '.md' : 'нет'}; ${u.next ? WD + '/' + u.next + '.md' : 'нет'}.`
}

function fixPrompt(u, b, nb, source, idxs) {
  return `${ctx(u)}

ТЫ — ПРАВЩИК участка, файл ${WD}/${u.id}.md (проход ${TAG}, пачка ${b + 1} из ${nb}).
${b === 0 ? `СНАЧАЛА сохрани резервную копию: mkdir -p ${WD}/_bak && cp ${WD}/${u.id}.md ${WD}/_bak/${u.id}_${TAG}.md` : `Предыдущие пачки этого прохода уже внесены в файл; цитаты части замечаний могли сместиться — находи место по смыслу; если замечание уже снято предыдущей правкой, пропусти его и назови.`}
Внеси правки (Edit) по подтверждённым (большинством из трёх независимых верификаторов) замечаниям: ${source}, записи с idx ${JSON.stringify(idxs)} (поле refined — уточнения верификаторов). Каждая правка — минимальная и сама удовлетворяет ядру v4 и соглашениям (статус по связке; одно предложение — один ход; полные термины; определения по V5; данность с атрибуцией и %%src%%; H2/H3 не менять; ссылки [[#…]] — только на существующие заголовки, проверь Grep'ом по ${WD}). Дефект перехода чинится скелетом (вставка вопроса или нехватки), а не словами стыка; вставка — в шов, следующий ход открывается из вставки. Дубликаты вноси один раз. Если замечания противоречат друг другу — реши по пунктам ядра и запиши причину. Если правка меняет имя или определение термина — согласуй его употребления в этом участке; правки, нужные в других участках, не вноси, а перечисли в notes (участок, место, правка). Утверждение о книге — только после сверки по строкам.
Перечитай файл. Других файлов (кроме резервной копии) не создавай и не редактируй. Верни сводку по схеме.`
}

const results = await pipeline(A.units, async (u) => {
  let idxs = u.conf_idxs || null
  let source = u.conf_file ? `файл ${u.conf_file} (JSON-массив подтверждённых замечаний; idx — поле idx записи)` : ''
  if (u.need_verify) {
    const nv = (await parallel(u.need_verify.map(rk => () =>
      call(`${ctx(u)}

ТЫ — НЕЗАВИСИМЫЙ ВЕРИФИКАТОР замечаний (проход ${TAG}). Никакие файлы не редактируй.
Замечания — в файле ${u.findings_file} (JSON-массив, всего ${u.n_find}, idx от 0 до ${u.n_find - 1}); прочитай его целиком и для КАЖДОГО idx реши, настоящее ли это нарушение ядра v4 (прочитай текущий текст в указанном месте файла участка; цитата могла устареть).
${DISCIPLINE}
ТВОЯ РОЛЬ: ${ROLES[rk]}
Дубликаты: duplicate_of = idx более полного; иначе -1. Для подтверждённых — минимальная правка (refined_fix).`, { label: `verify:${u.id}:${rk}:${TAG}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: EFF })))).filter(Boolean)
    if (nv.length + (u.have_votes ? 1 : 0) < 2) return { id: u.id, status: 'incomplete', note: 'верификаторов меньше двух' }
    idxs = []
    const refined = {}
    for (let i = 0; i < u.n_find; i++) {
      let yes = u.have_votes ? (u.have_votes[i] || 0) : 0
      const nvv = nv.map(v => (v.verdicts || []).find(x => x.idx === i)).filter(v => v && v.confirmed)
      yes += nvv.length
      if (yes >= 2) { idxs.push(i); refined[i] = nvv.map(v => v.refined_fix) }
    }
    source = `файл ${u.findings_file} (все замечания; вносятся только перечисленные idx). Уточнения верификаторов (idx → минимальные правки): ${JSON.stringify(refined)}${u.have_file ? `. Уточнения первого верификатора — в файле ${u.have_file} (роль strict)` : ''}`
    log(`${u.id} ${TAG}: подтверждено ${idxs.length} из ${u.n_find}`)
  }
  if (!idxs || !idxs.length) return { id: u.id, status: 'clean', confirmed: 0 }
  const batches = []
  for (let i = 0; i < idxs.length; i += BATCH) batches.push(idxs.slice(i, i + BATCH))
  const out = []
  for (let b = 0; b < batches.length; b++) {
    const fx = await call(fixPrompt(u, b, batches.length, source, batches[b]), { label: `fix:${u.id}:${TAG}:b${b + 1}`, phase: 'Fix', schema: FIX_SUMMARY, effort: EFF })
    if (!fx) { log(`${u.id} ${TAG}: пачка ${b + 1}/${batches.length} не внесена`); return { id: u.id, status: 'incomplete', confirmed: idxs.length, done_batches: b, batches: batches.length, out } }
    out.push({ batch: b + 1, applied: fx.applied, not_applied: fx.not_applied, notes: fx.notes })
  }
  const applied = out.reduce((s, x) => s + x.applied, 0)
  log(`${u.id} ${TAG}: внесено ${applied} из ${idxs.length} (пачек ${batches.length})`)
  return { id: u.id, status: 'fixed', confirmed: idxs.length, applied, out }
})
const done = results.filter(Boolean)
const byStatus = {}
done.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1 })
return { tag: TAG, byStatus, done }

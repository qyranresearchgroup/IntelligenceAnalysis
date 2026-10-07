export const meta = {
  name: 'audit-doc-v4',
  description: 'Проверка документа целиком по методу v4: хребет и межраздельные стыки, реестры и сквозная онтология, служебный список; 3 верификатора; правки по разделам-адресатам',
  phases: [
    { title: 'Find', detail: '3 линзы уровня документа' },
    { title: 'Verify', detail: '3 независимых верификатора, большинство 2 из 3' },
    { title: 'Fix', detail: 'один правщик на раздел-адресат' },
  ],
}

const A = args
const TAG = A.tag
const WD = A.wdir
const EFF = 'medium'
const IDS = A.ids

const ITEM = {
  type: 'object',
  properties: {
    section: { type: 'string', enum: IDS, description: 'участок, в файле которого вносится правка (если правка нужна в двух — два замечания)' },
    where: { type: 'string' },
    quote: { type: 'string', description: 'точная цитата из файла участка' },
    point: { type: 'string', description: 'нарушенный пункт ядра v4 / режима А (с цитатой правила)' },
    explanation: { type: 'string' },
    proposed_fix: { type: 'string' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['section', 'where', 'quote', 'point', 'explanation', 'proposed_fix', 'severity'],
}
const FIND_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: ITEM }, checked_summary: { type: 'string' } }, required: ['findings', 'checked_summary'] }
const VERIFY_SCHEMA = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
    idx: { type: 'number' }, confirmed: { type: 'boolean' }, duplicate_of: { type: 'number' }, correct_point: { type: 'string' }, refined_fix: { type: 'string' }, reasoning: { type: 'string' },
  }, required: ['idx', 'confirmed', 'duplicate_of', 'correct_point', 'refined_fix', 'reasoning'] } } },
  required: ['verdicts'],
}
const FIX_SUMMARY = { type: 'object', properties: { applied: { type: 'number' }, not_applied: { type: 'number' }, notes: { type: 'string' } }, required: ['applied', 'not_applied', 'notes'] }

const BASE = `Проверка конспекта по разведывательному анализу (эмпирический предмет) по методу изложения v4 — на уровне ДОКУМЕНТА.
Ядро метода (единственный критерий; прочитай ЦЕЛИКОМ): ${A.method}. Режим А: ${A.mode}. Соглашения проекта (обязательны; раздел V11 — решения по всему тексту, важнее V10): ${A.sogl}. Замечание, которое предлагает отменить решение V10–V11, — нарушение, только если само решение нарушает пункт ядра (назови пункт). Основной источник: ${A.main_source}.
Текст целиком: ${A.assembled} (собран из файлов участков ${WD}/<id>.md, id: ${IDS.join(', ')}; правки — только в файлах участков). Служебный список целиком: ${A.service}. Фиксированный список H2/H3 и вопросный скелет: ${A.design} (§5.6, §3).
Книги: ${A.books}.`

const DISCIPLINE = `Дисциплина рецензента (ядро v4, «Как пользоваться»): замечание только с нарушенным пунктом (назови и процитируй правило); вес — не замечание; правило применяется к тексту, а не механически (проверь, возникает ли ложное прочтение); держи вердикт; то, что ядро допускает (навигационная backward-ссылка в начале раздела; 1–2 явных вопроса на главу; повтор полного термина), — не нарушение. Цитаты — точные, из файла участка, указанного в section.`

const LENSES = [
  ['DOC1', `ЛИНЗА DOC-1 — хребет документа. (1) Ведущий вопрос §0 и ответ на него цепочкой §1–§14: каждая часть вопроса закрыта. (2) Скелет на уровне H2 (вопрос → объект → нехватка) и КАЖДЫЙ межраздельный стык: вход раздела отвечает ровно на нехватку, которой кончается предыдущий (тест наивного читателя, тест подделки, тест пересказа). (3) Принцип 3 на уровне блоков. (4) §15 пересказывает именно изложенную цепочку теми же именами, без новых объектов и пропусков. (5) «Граница метода»: §16 и все прикладные места помечены «Интерпретация:». (6) Принцип 7: каждое обещание «разберём в §N» выполнено там и имеет опору здесь.`],
  ['DOC2', `ЛИНЗА DOC-2 — сквозная онтология и реестры. (1) Врезка «Параметры» и «Первичные понятия» §0: каждый относительный термин документа получает точку отсчёта из реестра параметров; тест полного раскрытия любого ключевого термина останавливается на первичном понятии из §0 (возьми не менее 15 ключевых терминов из разных разделов и раскрой их рекурсивно). (2) Приложение А против текста: каждая строка совпадает по объёму с определением в тексте; «где определено» указывает на место определения; каждый определённый в тексте термин есть в реестре и наоборот; алиасы зарегистрированы один раз. (3) Принцип 9 сквозь разделы: одно имя — один смысл; ни одного второго определения одного термина; вещь и мера разведены одинаково; имена закономерностей — по V7 соглашений. (4) Приложение Б против данностей текста: каждая данность и сообщение источника текста есть в Приложении Б с атрибуцией; атрибуции совпадают.`],
  ['DOC3', `ЛИНЗА DOC-3 — источники и служебный список (режим А, «Что выдаёт агент»; ядро «Источники и построение выводов»). (1) Текст чистый: ни одной служебной пометки (происхождение, «авторская запись», строки md, «статус —»). (2) Служебный список полон по структуре V8 для каждого раздела: построенные выводы с допущениями, местом результата в книге и способом проверки; непостроенные выводы; исключённое с причиной; расхождения и посылки; основной источник назван. (3) Каждая «Предпосылка:» текста и каждое отступление от основного источника записаны в служебном списке; каждое расхождение книг, решённое в тексте, — тоже. (4) Выборочно (не менее 12 мест из разных разделов, приоритет — числа, усилительные слова, атрибуции) сверь текст с книгами по строкам карты источников: содержание не искажено и не усилено. Замечание о служебном списке адресуй участку, чей служебный список неполон (section), и пиши «служебный список» в where.`],
]

const ROLES = [
  ['strict', 'СТРОГИЙ СУДЬЯ: подтверждай, если пункт ядра v4 / режима А действительно нарушен текущим текстом и это не исключение, которое ядро допускает.'],
  ['advocate', 'АДВОКАТ ТЕКСТА: ищи, почему это НЕ нарушение (исключения ядра; смысл исключает ложное прочтение; неверно прочитанный пункт; устаревшая цитата; вес вместо логики). Если пункт применим не бесспорно — confirmed=false.'],
  ['logic', 'ЛОГИКА ПРОТИВ ВЕСА: подтверждай, только если правка изменит одно из: что из чего следует; статус; категорию; точку отсчёта; однозначность раскрытия; порядок вопросов; объём понятия; согласие с источником; полноту служебного списка. Если меняется лишь звучание — confirmed=false.'],
]

async function call(prompt, opts) {
  let r = await agent(prompt, opts)
  if (!r) r = await agent(prompt, { ...opts, label: `${opts.label}:retry` })
  return r
}

phase('Find')
const rs = await parallel(LENSES.map(([k, t]) => () =>
  call(`${BASE}

ТЫ — РЕЦЕНЗЕНТ уровня документа (проход ${TAG}). Никакие файлы не редактируй.
${DISCIPLINE}
${t}
Верни замечания по схеме (пустой массив, если нарушений нет; в checked_summary — что проверено, скелет документа кратко).`, { label: `review:DOC:${k}:${TAG}`, phase: 'Find', schema: FIND_SCHEMA, effort: EFF }).then(r => r ? { ...r, lens: k } : null)))
const ok = rs.filter(Boolean)
const findings = []
ok.forEach(r => (r.findings || []).forEach(f => findings.push({ ...f, lens: r.lens })))
findings.forEach((f, i) => { f.idx = i })
log(`DOC ${TAG}: рецензентов ${ok.length}/${LENSES.length}; замечаний ${findings.length}`)
if (!findings.length) return { tag: TAG, complete: ok.length === LENSES.length, found: 0, confirmed: 0 }

phase('Verify')
const vs = (await parallel(ROLES.map(([rk, rt]) => () =>
  call(`${BASE}

ТЫ — НЕЗАВИСИМЫЙ ВЕРИФИКАТОР замечаний уровня документа (проход ${TAG}). Никакие файлы не редактируй.
Для КАЖДОГО замечания (idx): прочитай текущий текст в указанном участке (и в связанных участках) и реши, настоящее ли это нарушение ядра v4 / режима А.
${DISCIPLINE}
ТВОЯ РОЛЬ: ${rt}
Дубликаты: duplicate_of = idx более полного; иначе -1. Для подтверждённых — минимальная правка (refined_fix), удовлетворяющая ядру v4.
ЗАМЕЧАНИЯ: ${JSON.stringify(findings)}`, { label: `verify:DOC:${rk}:${TAG}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: EFF })))).filter(Boolean)
if (vs.length < 2) {
  log(`DOC ${TAG}: верификаторов ${vs.length}/3 — замечания не проверены`)
  return { tag: TAG, complete: false, found: findings.length, note: `верификаторов ${vs.length}/3` }
}
const confirmed = []
findings.forEach(f => {
  const yes = vs.map(v => (v.verdicts || []).find(x => x.idx === f.idx)).filter(v => v && v.confirmed)
  if (yes.length >= 2) confirmed.push({ ...f, refined: yes.map(v => v.refined_fix), points: yes.map(v => v.correct_point) })
})
const bySec = {}
confirmed.forEach(f => { (bySec[f.section] = bySec[f.section] || []).push(f) })
log(`DOC ${TAG}: подтверждено ${confirmed.length}; по участкам ${JSON.stringify(Object.fromEntries(Object.entries(bySec).map(([k, v]) => [k, v.length])))}`)

phase('Fix')
const fixes = await parallel(Object.entries(bySec).map(([sid, list]) => () =>
  call(`${BASE}

ТЫ — ПРАВЩИК участка ${sid}: файлы ${WD}/${sid}.md и ${A.outdir}/service_${sid}.md (проход ${TAG}, замечания уровня документа).
СНАЧАЛА: cp ${WD}/${sid}.md ${WD}/_bak/${sid}_${TAG}.md
Внеси подтверждённые правки (Edit), каждую — минимально и по ядру v4 и соглашениям (статус по связке; одно предложение — один ход; полные термины; определения по V5; данность с атрибуцией и %%src%%; заголовки H2/H3 не менять; ссылки [[#…]] — только на существующие заголовки). Дефект стыка чинится скелетом (вставка вопроса / нехватки), а не словами. Замечание о служебном списке — правкой ${A.outdir}/service_${sid}.md. Утверждение о книге — только после сверки по строкам. Если правка требует изменения другого участка — не правь его, а запиши в notes.
Перечитай файлы. Других файлов не редактируй.
ПОДТВЕРЖДЁННЫЕ (большинством из трёх верификаторов): ${JSON.stringify(list)}
Верни сводку по схеме.`, { label: `fix:${sid}:DOC:${TAG}`, phase: 'Fix', schema: FIX_SUMMARY, effort: EFF }).then(r => r ? { id: sid, ...r } : { id: sid, status: 'incomplete' })))
const done = fixes.filter(Boolean)
return { tag: TAG, complete: ok.length === LENSES.length, found: findings.length, confirmed: confirmed.length, bySec: Object.fromEntries(Object.entries(bySec).map(([k, v]) => [k, v.length])), fixes: done }

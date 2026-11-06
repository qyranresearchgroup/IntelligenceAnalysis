#!/usr/bin/env python3
"""Сборка Матчасть_аналитика.md из участков write_v3 и проверки по проекту v3.

Использование:
  python3 assemble_v3.py check          # только проверки собранного во временный файл
  python3 assemble_v3.py write          # собрать и записать в репозиторий (после проверок)
"""
import re
import sys
from pathlib import Path

SP = Path('/tmp/claude-0/-home-user-IntelligenceAnalysis/1d3fe7fa-279b-5280-8789-5d375c374ff1/scratchpad')
WD = SP / 'write_v3'
DESIGN = SP / 'design_v3' / 'DESIGN.md'
TARGET = Path('/home/user/IntelligenceAnalysis/Матчасть_аналитика.md')
TMP = SP / 'assembled_v3.md'

ORDER = ['S00'] + [f'S{i:02d}' for i in range(1, 17)] + ['SAPP']

FORBIDDEN = [
    (r'разные объекты', 'Принцип 3: мета-формула «X и Y — разные объекты»'),
    (r'\[!note\]\s*Разведение', 'Принцип 3: врезка «Разведение»'),
    (r'Разведение', 'Принцип 3: слово «Разведение» (проверить контекст)'),
    (r'дано авансом|здесь имя дано авансом', 'Проект 5.3: «дано авансом»'),
    (r'как только что зафиксировано', 'Проект 5.3 / DOC С5'),
    (r'[Мм]ост к ', 'Проект 5.3: «мост к…»'),
    (r'Костяк и практика', 'Принцип 7: ссылка на несуществующий файл'),
    (r'системн\w+ промпт', 'Граница метода: отсылка к системному промпту'),
    (r'\[\[#раздел\]\]|\[\[#…\]\]', 'шаблон ссылки'),
]


def fixed_headings():
    """Список H2/H3 из DESIGN §5.6 «Фиксированный список H2 / H3»."""
    text = DESIGN.read_text(encoding='utf-8')
    start = text.index('**Фиксированный список H2 / H3:**')
    end = text.index('**Таблица изменённых якорей', start)
    block = text[start:end]
    names = re.findall(r'`([^`]+)`', block)
    return names


def assemble():
    parts = []
    missing = []
    for sid in ORDER:
        p = WD / f'{sid}.md'
        if not p.exists():
            missing.append(sid)
            continue
        t = p.read_text(encoding='utf-8').strip('\n')
        t = re.sub(r'^\s*---\s*\n', '', t) if sid != 'S00' else t
        t = re.sub(r'\n\s*---\s*$', '', t)
        parts.append(t)
    body = '\n\n---\n\n'.join(parts) + '\n'
    return body, missing


def check(text):
    problems = []
    lines = text.split('\n')
    heads = [(i + 1, m.group(1), m.group(2).strip()) for i, l in enumerate(lines)
             for m in [re.match(r'^(#{1,3}) (.+)$', l)] if m]
    names = [h[2] for h in heads]
    # 1. дубли заголовков
    seen = {}
    for ln, lvl, nm in heads:
        if nm in seen:
            problems.append(f'дубль заголовка «{nm}» (строки {seen[nm]} и {ln})')
        seen[nm] = ln
    # 2. сверка с фиксированным списком
    fixed = fixed_headings()
    h23 = [nm for ln, lvl, nm in heads if lvl in ('##', '###')]
    for nm in fixed:
        if nm not in h23:
            problems.append(f'нет заголовка из проекта 5.6: «{nm}»')
    for nm in h23:
        if nm not in fixed:
            problems.append(f'заголовок вне проекта 5.6: «{nm}»')
    # порядок
    order_fixed = [n for n in fixed if n in h23]
    order_text = [n for n in h23 if n in fixed]
    if order_fixed != order_text:
        problems.append('порядок заголовков расходится с проектом 5.6')
    # 3. wikilinks
    links = re.findall(r'\[\[#([^\]|]+?)(?:\\?\|[^\]]*)?\]\]', text)
    for l in links:
        if l.strip() not in seen:
            problems.append(f'битая ссылка [[#{l}]]')
    # 4. запрещённые обороты
    for pat, why in FORBIDDEN:
        for i, l in enumerate(lines):
            if re.search(pat, l):
                problems.append(f'стр. {i+1}: {why}: …{l.strip()[:120]}…')
    # 5. явные вопросы в нехватках — только §5 и §9 (грубая эвристика: строки, заканчивающиеся «?», вне цитат)
    return problems, heads, links


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    body, missing = assemble()
    if missing:
        print('НЕ ХВАТАЕТ УЧАСТКОВ:', missing)
    TMP.write_text(body, encoding='utf-8')
    problems, heads, links = check(body)
    print(f'строк: {body.count(chr(10))}; заголовков: {len(heads)}; ссылок [[#…]]: {len(links)}')
    print(f'проблем: {len(problems)}')
    for p in problems:
        print(' -', p)
    if mode == 'write':
        if missing:
            print('Запись отменена: не все участки готовы')
            sys.exit(1)
        TARGET.write_text(body, encoding='utf-8')
        print('Записано в', TARGET)


if __name__ == '__main__':
    main()

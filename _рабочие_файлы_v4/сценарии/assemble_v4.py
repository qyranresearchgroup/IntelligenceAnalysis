#!/usr/bin/env python3
"""Сборка по v4 (режим А): текст без служебных пометок + служебный список.

  python3 assemble_v4.py check   # собрать во временные файлы и проверить
  python3 assemble_v4.py write   # записать текст и служебный список в репозиторий

Текст: участки write_v3/<id>.md в порядке ORDER; скрытые комментарии %%src: …%%
вынимаются и уходят в служебный список («Карта источников»), с привязкой к H2/H3
и началу предложения, к которому относились.
Служебный список: v4/SERVICE_HEAD.md (основной источник, расхождения, первичные
понятия) + v4/service_<id>.md по участкам + карта источников.
"""
import re
import sys
from pathlib import Path

import assemble_v3 as v3

SP = v3.SP
WD = v3.WD
V4 = SP / 'v4'
TARGET = v3.TARGET
SERVICE_TARGET = TARGET.with_name('Матчасть_аналитика — служебный список.md')
TMP = SP / 'assembled_v4.md'
TMP_SERVICE = SP / 'assembled_v4_service.md'
SRC_RE = re.compile(r'\s*%%src:\s*(.*?)%%', re.S)

EXTRA_FORBIDDEN = [
    (r'%%', 'Режим А: служебная пометка в тексте'),
    (r'в котор\w+ (он|она|оно|они) существу', 'v4 п. 3: определение утверждает существование'),
]


def strip_sources(body):
    """Вынуть %%src%%; вернуть (текст, записи карты источников)."""
    entries = []
    h2 = h3 = ''
    out_lines = []
    for line in body.split('\n'):
        m = re.match(r'^(#{2,3}) (.+)$', line)
        if m:
            if m.group(1) == '##':
                h2, h3 = m.group(2).strip(), ''
            else:
                h3 = m.group(2).strip()
        if '%%' in line:
            pos = 0
            for sm in SRC_RE.finditer(line):
                before = line[:sm.start()]
                ss = re.split(r'(?<=[.!?…])\s+(?=[А-ЯЁA-Z«(\[*])', before.strip()) if before.strip() else ['']
                sent = ss[-1]
                if len(sent) < 50 and len(ss) > 1:
                    sent = ss[-2] + ' ' + sent
                sent = re.sub(r'^[>\-\*\s]+', '', sent)
                entries.append((h2, h3, sent[:160], sm.group(1).strip()))
            line = SRC_RE.sub('', line).rstrip()
        out_lines.append(line)
    return '\n'.join(out_lines), entries


def service_text(entries):
    parts = ['# Матчасть аналитика — служебный список', '',
             'Служебный список по методу изложения v4, режим А. Ведётся отдельно от текста; '
             'в тексте служебных пометок нет.', '']
    head = V4 / 'SERVICE_HEAD.md'
    if head.exists():
        parts.append(head.read_text(encoding='utf-8').strip())
        parts.append('')
    for sid in v3.ORDER:
        p = V4 / f'service_{sid}.md'
        if p.exists():
            t = p.read_text(encoding='utf-8').strip()
            t = re.sub(r'^# ', '## ', t, flags=re.M) if not t.startswith('## ') else t
            parts.append(t)
            parts.append('')
    parts.append('## Карта источников')
    parts.append('')
    parts.append('Строки книг, по которым сверены данности и сообщения источников '
                 '(Hm — Heuer 1999, Pm — Pherson & Heuer 2021, Tm — Tetlock & Gardner 2015; '
                 'номера строк — в markdown-файлах книг в репозитории).')
    parts.append('')
    parts.append('| Раздел | Подраздел | Место (начало предложения) | Строки книг |')
    parts.append('|---|---|---|---|')
    for h2, h3, sent, ref in entries:
        cell = sent.replace('|', '\\|')
        parts.append(f'| {h2} | {h3} | {cell} | {ref} |')
    return '\n'.join(parts) + '\n'


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    body, missing = v3.assemble()
    if missing:
        print('НЕ ХВАТАЕТ УЧАСТКОВ:', missing)
    text, entries = strip_sources(body)
    TMP.write_text(text, encoding='utf-8')
    problems, heads, links = v3.check(text)
    for pat, why in EXTRA_FORBIDDEN:
        for i, l in enumerate(text.split('\n')):
            if re.search(pat, l):
                problems.append(f'стр. {i+1}: {why}: …{l.strip()[:120]}…')
    svc = service_text(entries)
    TMP_SERVICE.write_text(svc, encoding='utf-8')
    print(f'строк: {text.count(chr(10))}; заголовков: {len(heads)}; ссылок [[#…]]: {len(links)}; '
          f'вынуто %%src%%: {len(entries)}')
    # «проверить контекст» — предупреждение, а не запрет: проверяется вручную;
    # запрет — только врезка или заголовок с этим словом (их ловят остальные шаблоны)
    warnings = [p for p in problems if 'проверить контекст' in p]
    problems = [p for p in problems if 'проверить контекст' not in p]
    for w in warnings:
        print(' ! предупреждение:', w)
    print(f'проблем: {len(problems)}')
    for p in problems:
        print(' -', p)
    if mode == 'write':
        if missing or problems:
            print('Запись отменена: есть недостающие участки или проблемы')
            sys.exit(1)
        TARGET.write_text(text, encoding='utf-8')
        SERVICE_TARGET.write_text(svc, encoding='utf-8')
        print('Записано:', TARGET, 'и', SERVICE_TARGET)


if __name__ == '__main__':
    main()

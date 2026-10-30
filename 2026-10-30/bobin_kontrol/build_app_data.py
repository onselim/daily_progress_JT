"""Builds the project_config 'conductor_drums' record (Part-1 drums received + Part-1 etap plan, the user's own Etap list) and the SQL.
Input: kontrol.json written by build_kontrol.py. Run: python -I build_app_data.py"""
import json, re, collections

d = json.load(open('kontrol.json', encoding='utf-8'))
etaps, drums = d['etaps'], d['drums']

# Supplied lengths that replace the planned ones in an etap (checked on 30.10.2026: all still cover the etap)
SUBST = {'21': {2100: 8, 2090: 1}, '54': {1850: 9}, '62': {1750: 9}}
NOTE = {
    '10': ('Etap 2094 m: 2100 m bobinler gerekir, 2090 m\'lik bobin buraya gitmemeli.', 'Section 2094 m: needs the 2100 m drums, the 2090 m drum must not go here.'),
    '21': ('Planda 9 × 2100 m idi; 1 adet 2090 m\'lik geldi, etap 2069 m olduğu için buraya kullanılır.', 'Planned 9 × 2100 m; one 2090 m drum arrived and is used here (section 2069 m).'),
    '40': ('2150 m bobinler ikiye bölünür: yarım 1075 m, ihtiyaç 1068 m.', 'The 2150 m drums are split in two: half 1075 m, need 1068 m.'),
    '51': ('2100 m bobinler ikiye bölünür: yarım 1050 m, ihtiyaç 1049 m (1 m pay). Tam ortadan kesin; 2090 m\'lik bobin buraya gitmez.', 'The 2100 m drums are split in two: half 1050 m, need 1049 m (1 m margin). Cut exactly in the middle; the 2090 m drum cannot be used here.'),
    '54': ('Planda 9 × 1800 m idi, 1850 m geldi.', 'Planned 9 × 1800 m, 1850 m arrived.'),
    '62': ('Planda 9 × 1700 m idi, 1750 m geldi.', 'Planned 9 × 1700 m, 1750 m arrived.'),
}
out_etaps = []
for e in etaps:
    cur = SUBST.get(e['start'], {int(k): v for k, v in e['new'].items()})
    out_etaps.append(dict(
        name=f"{e['start']}–{e['end']}",
        sec=round(e['sec']) if e['sec'] else None,
        drums=[dict(len=k, count=v) for k, v in sorted(cur.items())],
        use=re.sub(r'\s+', ' ', e['L']),
        noteTr=NOTE.get(e['start'], ('', ''))[0], noteEn=NOTE.get(e['start'], ('', ''))[1]))

used = collections.Counter()
for e in out_etaps:
    for x in e['drums']: used[x['len']] += x['count']
sup500 = collections.Counter(x['len'] for x in drums if x['forr'] == '500 kV')
stock = {L: sup500[L] - used[L] for L in sup500 if sup500[L] - used[L] != 0}
print('stock by length (supplied - used in etaps):', stock)
assert stock == {2050: 1}, stock

data = dict(
    conductor='AC 400/51', line='Part-1 (G1–65)',
    source='Hasçelik packing list (1st lot, Dec 2023), truck lists 22.08–04.09.2024; etap plan: Etap Listesi Part1_29112023',
    checked='2026-10-30',
    drums=[dict(no=x['no'], id=x['id'], len=x['len'], kv=500 if x['forr'] == '500 kV' else 220, truck=x['truck'], date=x['date']) for x in drums],
    etaps=out_etaps,
    stock=[dict(len=2050, count=1, noteTr='Part 1 etaplarından artan 2050 m\'lik bobin; hattın diğer kısımları için ayrıldı (110–G2 listesinin stoğuna girildi).',
                noteEn='Spare 2050 m drum left after the Part-1 sections; kept for other parts of the line (entered as stock of the 110–G2 list).')])
json.dump(data, open('conductor_drums.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

sql = f"""-- Part-1 conductor drums received + Part-1 etap plan (30.10.2026)
-- 1) record shown in the Supply panel ("Conductor drums") and in the drum list panel ("Part 1 etap plan")
insert into public.project_config (project_id, key, value)
select p.id, 'conductor_drums', $json${json.dumps(data, ensure_ascii=False, separators=(',', ':'))}$json$::jsonb
from public.projects p
where p.slug = 'jvari-tskaltubo'
on conflict (project_id, key) do update set value = excluded.value;

-- 2) the spare 2050 m drum becomes stock of the 110-G2 drum list (used first when the plan is computed)
update public.project_config c
set value = jsonb_set(c.value, '{{lists,0,stock}}', '[{{"name":"Part-1 spare","length":2050,"count":1,"cond":""}}]'::jsonb, true)
from public.projects p
where p.id = c.project_id and p.slug = 'jvari-tskaltubo' and c.key = 'drum_plans'
  and c.value #>> '{{lists,0,id}}' = 'list-1';
"""
open('SQL_part1_bobinler.sql', 'w', encoding='utf-8').write(sql)
print(len(sql), 'bytes SQL')

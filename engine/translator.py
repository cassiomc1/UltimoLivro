"""Tradutor offline e guia multilíngue de emergência (Inglês / Espanhol / Português do Brasil).

Usa a IA local já instalada (com cache em disco para páginas dos manuais) e inclui
um guia de frases e glossário técnico embutido que funciona mesmo sem modelo de IA.
"""
import hashlib
import json
import os
import re
import time
from pathlib import Path

GLOSSARY = [
    {
        'category': 'Saúde e Primeiros Socorros',
        'items': [
            {'en': 'Apply firm direct pressure to stop severe bleeding.', 'es': 'Aplique presión directa y firme para detener el sangrado grave.', 'pt': 'Aplique pressão direta e firme para estancar o sangramento grave.'},
            {'en': 'Tourniquet — use only for life-threatening limb bleeding; note the exact time applied.', 'es': 'Torniquete — usar solo en hemorragias mortales en extremidades; anotar la hora exacta.', 'pt': 'Torniquete — use apenas em hemorragia grave em braços/pernas; anote a hora exata da aplicação.'},
            {'en': 'Oral Rehydration Solution (ORS): 1 L clean water + 6 level tsp sugar + 1/2 tsp salt.', 'es': 'Suero de rehidratación oral: 1 L de agua limpia + 6 cucharaditas rasas de azúcar + 1/2 de sal.', 'pt': 'Soro caseiro / Reidratação oral: 1 L de água potável + 6 colheres (chá) rasas de açúcar + 1/2 colher (chá) de sal.'},
            {'en': 'Cool burns immediately with cool running clean water for 10 to 20 minutes. Do not apply ice or butter.', 'es': 'Enfriar quemaduras con agua limpia fresca de 10 a 20 min. No usar hielo ni mantequilla.', 'pt': 'Resfrie queimaduras com água limpa corrente fria por 10 a 20 minutos. Não use gelo, pasta ou manteiga.'},
            {'en': 'Recovery position (lateral safety position) if unconscious and breathing normally.', 'es': 'Posición lateral de seguridad si está inconsciente y respira con normalidad.', 'pt': 'Posição lateral de segurança se estiver inconsciente mas respirando normalmente.'},
            {'en': 'Severe allergic reaction / Anaphylaxis / Epinephrine', 'es': 'Reacción alérgica grave / Anafilaxia / Epinefrina', 'pt': 'Reação alérgica grave / Anafilaxia / Adrenalina (Epinefrina)'},
            {'en': 'Hypothermia — move to warm dry shelter, remove wet clothes, warm core gradually.', 'es': 'Hipotermia — trasladar a refugio seco, quitar ropa mojada, calentar el tronco gradualmente.', 'pt': 'Hipotermia — leve para abrigo seco, retire roupas molhadas e aqueça o tronco gradualmente.'},
            {'en': 'Fracture / Splint — immobilize above and below the injury without forcing bone back.', 'es': 'Fractura / Férula — inmovilizar por encima y debajo de la lesión sin forzar el hueso.', 'pt': 'Fratura / Tala — imobilize acima e abaixo da lesão sem tentar colocar o osso no lugar.'},
        ],
    },
    {
        'category': 'Água, Saneamento e Alimentos',
        'items': [
            {'en': 'Bring water to a rolling boil for at least 1 minute (3 minutes above 2,000 m altitude).', 'es': 'Hervir el agua a borbotones al menos 1 minuto (3 minutos a más de 2.000 m).', 'pt': 'Ferva a água em ebulição vigorosa por pelo menos 1 minuto (3 minutos acima de 2.000 m de altitude).'},
            {'en': 'Household bleach (unscented sodium hypochlorite 5%–6%): 2 drops per liter of clear water (wait 30 min).', 'es': 'Lejía doméstica sin aroma (5%–6%): 2 gotas por litro de agua clara (esperar 30 min).', 'pt': 'Água sanitária sem perfume (hipoclorito de sódio 2,0%–2,5% no Brasil): 2 gotas por litro (espere 30 minutos).'},
            {'en': 'Do not use flooded or stagnant water for drinking without filtering and disinfecting.', 'es': 'No usar agua de inundación o estancada sin filtrar y desinfectar.', 'pt': 'Não beba água de enchente ou parada sem filtrar e desinfetar.'},
            {'en': 'Refrigerator off > 4 hours: discard meat, dairy, eggs and leftovers held above 4 °C (40 °F).', 'es': 'Nevera apagada > 4 h: desechar carne, lácteos, huevos y sobras por encima de 4 °C.', 'pt': 'Geladeira desligada por mais de 4 horas: descarte carnes, laticínios, ovos e sobras acima de 4 °C.'},
            {'en': 'Two-bucket emergency toilet: keep solids and liquids separate; cover solids with sawdust, ash or lime.', 'es': 'Inodoro de emergencia de dos cubos: separar sólidos y líquidos; cubrir sólidos con serrín o ceniza.', 'pt': 'Banheiro de emergência com dois baldes: separe urina e fezes; cubra os sólidos com serragem, cinza ou cal.'},
        ],
    },
    {
        'category': 'Energia, Geradores e Segurança Elétrica',
        'items': [
            {'en': 'Carbon monoxide (CO) danger: operate generators ONLY outdoors at least 6 meters (20 ft) from windows and doors.', 'es': 'Peligro de monóxido de carbono (CO): usar generadores SOLO al aire libre a más de 6 m de ventanas y puertas.', 'pt': 'Perigo de monóxido de carbono (CO): ligue geradores SOMENTE ao ar livre, a pelo menos 6 metros de portas e janelas.'},
            {'en': 'Never plug a generator into a wall outlet (backfeeding kills utility workers and causes fire).', 'es': 'Nunca enchufar un generador en una toma de pared (retroalimentación peligrosa).', 'pt': 'Nunca ligue o gerador diretamente na tomada da parede (retorno de energia é fatal e causa incêndio).'},
            {'en': 'Turn off main breaker before connecting a generator through a transfer switch.', 'es': 'Desconectar el interruptor principal antes de usar el cuadro de transferencia.', 'pt': 'Desligue o disjuntor geral antes de transferir energia para o gerador com chave reversora.'},
            {'en': 'Smell of gas: do not flip light switches or strike matches. Open doors and leave the building.', 'es': 'Olor a gas: no accionar interruptores ni encender llamas. Abrir puertas y salir del edificio.', 'pt': 'Cheiro de gás: não acione interruptores nem acenda fogo. Abra portas/janelas, feche o registro e saia do local.'},
        ],
    },
    {
        'category': 'Comunicação, Abrigo e Socorro',
        'items': [
            {'en': 'We need medical help / injured person here.', 'es': 'Necesitamos ayuda médica / hay una persona herida aquí.', 'pt': 'Precisamos de atendimento médico / há uma pessoa ferida aqui.'},
            {'en': 'Do you have clean drinking water?', 'es': '¿Tiene agua potable?', 'pt': 'Você tem água potável limpa?'},
            {'en': 'Where is the nearest hospital / shelter?', 'es': '¿Dónde está el hospital o refugio más cercano?', 'pt': 'Onde fica o hospital ou abrigo mais próximo?'},
            {'en': 'Battery-powered / hand-crank AM/FM weather radio', 'es': 'Radio AM/FM de pilas o dinamo de emergencia', 'pt': 'Rádio AM/FM a pilha ou dínamo de emergência'},
            {'en': 'Emergency numbers in Brazil: 192 SAMU · 193 Fire/Rescue · 190 Police · 199 Civil Defense', 'es': 'Emergencias en Brasil: 192 SAMU · 193 Bomberos · 190 Policía · 199 Defensa Civil', 'pt': 'Emergência no Brasil: 192 SAMU · 193 Bombeiros · 190 Polícia · 199 Defesa Civil'},
        ],
    },
]

_TERM_MAP = [
    (r'\bwarning\b', 'warning', 'AVISO'),
    (r'\bcaution\b', 'caution', 'ATENÇÃO'),
    (r'\bdanger\b', 'danger', 'PERIGO'),
    (r'\bnote\b', 'note', 'NOTA'),
    (r'\bcarbon monoxide\b', 'carbon monoxide', 'monóxido de carbono'),
    (r'\bgenerator\b', 'generator', 'gerador'),
    (r'\bdrinking water\b', 'drinking water', 'água potável'),
    (r'\bboil water\b', 'boil water', 'ferver a água'),
    (r'\bbleach\b', 'bleach', 'água sanitária / hipoclorito'),
    (r'\bfilter\b', 'filter', 'filtro'),
    (r'\bfirst aid\b', 'first aid', 'primeiros socorros'),
    (r'\bbleeding\b', 'bleeding', 'sangramento / hemorragia'),
    (r'\bburns?\b', 'burn(s)', 'queimadura(s)'),
    (r'\btourniquet\b', 'tourniquet', 'torniquete'),
    (r'\bhypothermia\b', 'hypothermia', 'hipotermia'),
    (r'\bheat stroke\b', 'heat stroke', 'intermação / insolação'),
    (r'\bbandage\b', 'bandage', 'curativo / atadura'),
    (r'\bsterile\b', 'sterile', 'estéril'),
    (r'\binfection\b', 'infection', 'infecção'),
    (r'\bfever\b', 'fever', 'febre'),
    (r'\bdehydration\b', 'dehydration', 'desidratação'),
    (r'\bcircuit breaker\b', 'circuit breaker', 'disjuntor'),
    (r'\boutdoors\b', 'outdoors', 'ao ar livre'),
    (r'\bwind\b', 'wind', 'vento'),
    (r'\bshelter\b', 'shelter', 'abrigo'),
    (r'\bfood safety\b', 'food safety', 'segurança dos alimentos'),
    (r'\brefrigerator\b', 'refrigerator', 'geladeira'),
    (r'\boil\b', 'oil', 'óleo'),
    (r'\bfuel\b', 'fuel', 'combustível'),
    (r'\bspark plug\b', 'spark plug', 'vela de ignição'),
    (r'\bbattery\b', 'battery', 'bateria'),
    (r'\bsolar panel\b', 'solar panel', 'painel solar'),
    (r'\badvertencia\b', 'advertencia', 'AVISO'),
    (r'\bpeligro\b', 'peligro', 'PERIGO'),
    (r'\bprecauci[óo]n\b', 'precaución', 'ATENÇÃO'),
    (r'\bagua potable\b', 'agua potable', 'água potável'),
    (r'\bprimeros auxilios\b', 'primeros auxilios', 'primeiros socorros'),
    (r'\bhemorragia\b', 'hemorragia', 'hemorragia'),
]


def _cache_dir(data_dir=None):
    base = Path(data_dir) if data_dir else Path(os.environ.get('LASTBOOK_DATA') or '.')
    return base / 'derived' / 'translations'


def _safe_token(value, default, max_len=40):
    cleaned = re.sub(r'[^A-Za-z0-9_-]+', '_', str(value or '')).strip('_')[:max_len]
    return cleaned or default


def _cache_path(text, source, target, doc_id=None, page=None, data_dir=None):
    h = hashlib.sha256(f'{source}|{target}|{text}'.encode('utf-8')).hexdigest()[:24]
    safe_target = _safe_token(target, 'pt-BR', 20)
    if doc_id:
        safe_id = _safe_token(doc_id, 'doc', 60)
        safe_page = _safe_token(page, '', 16)
        p = f'p{safe_page}' if safe_page else 'all'
        name = f'{safe_id}_{p}_{safe_target}_{h}.json'
    else:
        name = f'txt_{safe_target}_{h}.json'
    return _cache_dir(data_dir) / name


def glossary():
    return GLOSSARY


def _chunks(text, limit=2400):
    text = text.strip()
    if len(text) <= limit:
        return [text]
    out, cur = [], []
    cur_len = 0
    for para in re.split(r'\n{2,}', text):
        if cur_len and cur_len + len(para) + 2 > limit:
            out.append('\n\n'.join(cur))
            cur, cur_len = [], 0
        if len(para) <= limit:
            cur.append(para)
            cur_len += len(para) + 2
        else:
            for i in range(0, len(para), limit):
                out.append(para[i:i + limit])
    if cur:
        out.append('\n\n'.join(cur))
    return out


def _target_label(target):
    t = (target or 'pt-BR').lower()
    if t.startswith('pt'):
        return 'Português do Brasil (pt-BR)'
    if t.startswith('en'):
        return 'Inglês (English)'
    if t.startswith('es'):
        return 'Espanhol (Español)'
    return target


_GLOSSARY_STOP = {
    'with', 'from', 'that', 'this', 'only', 'have', 'need', 'your', 'about', 'into',
    'para', 'como', 'mais', 'pelo', 'pela', 'sempre', 'sobre', 'agua', 'água', 'limpa',
    'sobre', 'entre', 'menos', 'usar', 'para', 'solo', 'hacia', 'desde', 'esta', 'este',
}


def _target_lang_key(target):
    t = (target or 'pt-BR').lower()
    if t.startswith('en'):
        return 'en'
    if t.startswith('es'):
        return 'es'
    return 'pt'


def _glossary_fallback(text, target='pt-BR'):
    hits = []
    low = text.lower()
    for pat, label, pt in _TERM_MAP:
        if re.search(pat, low, re.I):
            hits.append((label, pt))
    matched_phrases = []
    for cat in GLOSSARY:
        for it in cat['items']:
            pool = f"{it['en']} {it['es']} {it['pt']}".lower()
            words = set(w for w in re.findall(r'[a-zà-ÿ]{4,}', pool) if w not in _GLOSSARY_STOP)
            if sum(1 for w in words if w in low) >= 2:
                matched_phrases.append(it)
    return hits, matched_phrases, _target_lang_key(target)


def translate(text, source='auto', target='pt-BR', doc_id=None, page=None, data_dir=None):
    raw = str(text or '').strip()
    if not raw:
        return {'error': 'Informe um texto para traduzir.'}
    raw = raw[:12_000]
    source = str(source or 'auto')[:20]
    target = str(target or 'pt-BR')[:20]
    t0 = time.time()
    cpath = _cache_path(raw, source, target, doc_id, page, data_dir)
    if cpath.is_file():
        try:
            cached = json.loads(cpath.read_text(encoding='utf-8'))
            if cached.get('translated') and cached.get('mode') == 'ai':
                cached['cached'] = True
                cached['elapsed_s'] = round(time.time() - t0, 2)
                return cached
        except (OSError, ValueError):
            pass

    import assistant
    import llm_local
    use_local = assistant.local_on()
    st = None if use_local else assistant.model_status()
    use_http = bool(st and st.get('online') and not st.get('local'))

    if use_local or use_http:
        if use_local:
            why = assistant.LOCAL.ensure_running()
            if why:
                use_local = False
        if use_local or use_http:
            tgt_label = _target_label(target)
            src_hint = '' if source == 'auto' else f' de {_target_label(source)}'
            sys_msg = (
                f'Você é um tradutor técnico preciso e fiel para situações de emergência. '
                f'Traduza o texto a seguir{src_hint} para {tgt_label}. '
                f'Regras obrigatórias: mantenha exatamente os números, medidas, dosagens, horários, avisos de segurança e a formatação simples. '
                f'NÃO escreva comentários, explicações nem pensamento prévio — devolva SOMENTE a tradução direta.'
            )
            pieces = []
            for ch in _chunks(raw):
                msgs = [
                    {'role': 'system', 'content': sys_msg},
                    {'role': 'user', 'content': f'Traduza{src_hint} para {tgt_label}:\n\n{ch}'},
                ]
                if use_local:
                    got = assistant._local_round(msgs, None, lambda: False, lambda _: None, lambda _: None)
                else:
                    got = assistant._http_round(msgs, None, lambda: False, lambda _: None, lambda _: None)
                cleaned = llm_local._strip_thinking(got[0]).strip() if isinstance(got, tuple) else ''
                if cleaned:
                    pieces.append(cleaned)
                else:
                    pieces = []
                    break
            if pieces:
                translated = '\n\n'.join(pieces).strip()
                res = {
                    'translated': translated,
                    'mode': 'ai',
                    'model': (assistant.LOCAL.status()['title'] if use_local else assistant.MODEL),
                    'source': source,
                    'target': target,
                    'cached': False,
                    'elapsed_s': round(time.time() - t0, 2),
                }
                tmp = cpath.with_name(f'.{cpath.name}.{os.getpid()}.{time.time_ns()}.tmp')
                try:
                    cpath.parent.mkdir(parents=True, exist_ok=True)
                    tmp.write_text(json.dumps(res, ensure_ascii=False), encoding='utf-8')
                    os.replace(tmp, cpath)
                except OSError:
                    try:
                        tmp.unlink(missing_ok=True)
                    except OSError:
                        pass
                return res

    # Fallback sem IA instalada: glossário técnico e frases de emergência correspondentes em texto limpo.
    term_hits, phrase_hits, lang_key = _glossary_fallback(raw, target=target)
    lines = ['Modo Glossário Offline (nenhum modelo de IA local instalado ou ativo no momento)', '']
    if term_hits:
        lines.append('Termos-chave identificados no texto:')
        for orig, pt in term_hits:
            lines.append(f'- {orig} -> {pt}')
        lines.append('')
    if phrase_hits:
        lines.append('Instruções relacionadas do guia de emergência:')
        for ph in phrase_hits[:6]:
            lines.append(f'- {ph[lang_key]}')
        lines.append('')
    if not term_hits and not phrase_hits:
        lines.append('Nenhum termo específico do glossário rápido foi identificado neste trecho.')
        lines.append('')
    lines.append('Para tradução neural completa de qualquer página ou texto offline, instale um modelo de IA local (ex.: Qwen 3.5 0.8B ou Gemma 4 E2B) em Biblioteca e IA local.')
    return {
        'translated': '\n'.join(lines),
        'mode': 'glossary',
        'model': None,
        'source': source,
        'target': target,
        'cached': False,
        'elapsed_s': round(time.time() - t0, 2),
    }

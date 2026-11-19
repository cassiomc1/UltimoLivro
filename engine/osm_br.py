"""OpenStreetMap integration for Brazilian states, offline map building, tiles, and CEP/address lookup."""
import hashlib
import json
import math
import os
import re
import shutil
import sqlite3
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from array import array
from pathlib import Path

from engine import address_search
from engine.setup import download, install

def ro_uri(path):
    return Path(path).resolve().as_uri() + '?mode=ro'

USER_AGENT = 'UltimoLivro/1.0 (https://www.openstreetmap.org/)'
_Q = 1e6
_OSM_LOCK = threading.Lock()
_OSM_SEM = threading.Semaphore(4)
_TILE_FAIL = {}
_CACHE_LOCK = threading.Lock()

# (Nome do estado, Capital, lat capital, lon capital, [west, south, east, north])
BR_STATES = {
    'AC': ('Acre', 'Rio Branco', -9.9754, -67.8249, [-73.99, -11.15, -66.62, -7.11]),
    'AL': ('Alagoas', 'Maceió', -9.6658, -35.7353, [-38.24, -10.50, -35.15, -8.81]),
    'AP': ('Amapá', 'Macapá', 0.0349, -51.0694, [-54.88, -1.24, -49.87, 4.44]),
    'AM': ('Amazonas', 'Manaus', -3.1190, -60.0217, [-73.80, -9.82, -56.10, 2.25]),
    'BA': ('Bahia', 'Salvador', -12.9714, -38.5014, [-46.62, -18.35, -37.34, -8.53]),
    'CE': ('Ceará', 'Fortaleza', -3.7319, -38.5267, [-41.42, -7.86, -37.25, -2.78]),
    'DF': ('Distrito Federal', 'Brasília', -15.7975, -47.8919, [-48.29, -16.05, -47.31, -15.50]),
    'ES': ('Espírito Santo', 'Vitória', -20.3155, -40.3128, [-41.88, -21.30, -39.66, -17.89]),
    'GO': ('Goiás', 'Goiânia', -16.6869, -49.2648, [-53.25, -19.50, -45.91, -12.39]),
    'MA': ('Maranhão', 'São Luís', -2.5307, -44.3068, [-48.76, -10.26, -41.79, -1.04]),
    'MT': ('Mato Grosso', 'Cuiabá', -15.6014, -56.0979, [-61.63, -18.04, -50.22, -7.35]),
    'MS': ('Mato Grosso do Sul', 'Campo Grande', -20.4697, -54.6201, [-58.17, -24.07, -50.92, -17.17]),
    'MG': ('Minas Gerais', 'Belo Horizonte', -19.9167, -43.9345, [-51.05, -22.92, -39.86, -14.23]),
    'PA': ('Pará', 'Belém', -1.4558, -48.4902, [-58.90, -9.84, -46.06, 2.59]),
    'PB': ('Paraíba', 'João Pessoa', -7.1195, -34.8450, [-38.77, -8.30, -34.79, -6.03]),
    'PR': ('Paraná', 'Curitiba', -25.4284, -49.2733, [-54.62, -26.72, -48.02, -22.52]),
    'PE': ('Pernambuco', 'Recife', -8.0476, -34.8770, [-41.36, -9.48, -34.80, -7.15]),
    'PI': ('Piauí', 'Teresina', -5.0920, -42.8038, [-45.99, -10.93, -40.37, -2.74]),
    'RJ': ('Rio de Janeiro', 'Rio de Janeiro', -22.9068, -43.1729, [-44.89, -23.37, -40.96, -20.76]),
    'RN': ('Rio Grande do Norte', 'Natal', -5.7793, -35.2009, [-38.58, -6.98, -34.97, -4.83]),
    'RS': ('Rio Grande do Sul', 'Porto Alegre', -30.0346, -51.2177, [-57.65, -33.75, -49.69, -27.08]),
    'RO': ('Rondônia', 'Porto Velho', -8.7612, -63.9004, [-66.81, -13.69, -59.77, -7.97]),
    'RR': ('Roraima', 'Boa Vista', 2.8235, -60.6758, [-64.82, -1.58, -58.89, 5.27]),
    'SC': ('Santa Catarina', 'Florianópolis', -27.5954, -48.5480, [-53.84, -29.35, -48.36, -25.95]),
    'SP': ('São Paulo', 'São Paulo', -23.5505, -46.6333, [-53.11, -25.31, -44.16, -19.78]),
    'SE': ('Sergipe', 'Aracaju', -10.9472, -37.0731, [-38.25, -11.57, -36.39, -9.51]),
    'TO': ('Tocantins', 'Palmas', -10.1840, -48.3336, [-50.74, -13.47, -45.73, -5.17]),
}

_ROAD_Z = {
    'motorway': 5, 'trunk': 6, 'motorway_link': 10, 'trunk_link': 10, 'primary': 8, 'primary_link': 12,
    'secondary': 10, 'secondary_link': 13, 'tertiary': 11, 'tertiary_link': 13, 'residential': 13,
    'unclassified': 13, 'living_street': 14, 'pedestrian': 14, 'busway': 14, 'service': 15,
    'track': 13, 'footway': 15, 'path': 14, 'cycleway': 14, 'steps': 16, 'bridleway': 14,
}
_LANDUSE_KEEP = {
    'park': 'park', 'forest': 'green', 'grass': 'green', 'meadow': 'green', 'scrub': 'green',
    'heath': 'green', 'recreation_ground': 'park', 'cemetery': 'park', 'allotments': 'farm',
    'farmland': 'farm', 'orchard': 'farm', 'vineyard': 'farm', 'farmyard': 'farm',
    'residential': 'res', 'commercial': 'com', 'retail': 'com', 'industrial': 'ind',
}
_POI_KEEP = {
    'hospital', 'clinic', 'doctors', 'pharmacy', 'chemist', 'dentist', 'veterinary',
    'fire_station', 'police', 'drinking_water', 'water_tower', 'water_works', 'fountain',
    'toilet', 'shelter', 'community_centre', 'town_hall', 'school', 'library',
    'supermarket', 'convenience', 'doityourself', 'hardware', 'garden_centre',
    'post_office', 'camp_site', 'wastewater_plant', 'comms_tower', 'spring', 'park',
    'courthouse', 'embassy', 'nursing_home', 'kindergarten', 'college', 'university',
    'bicycle_shop', 'car_repair', 'fuel', 'beach',
}
_POI_QUERIES = [
    ('hospital', 'hospital'),
    ('clinic', 'posto de saude'),
    ('pharmacy', 'farmacia'),
    ('fire_station', 'corpo de bombeiros'),
    ('police', 'delegacia policia'),
    ('supermarket', 'supermercado'),
    ('fuel', 'posto de combustivel'),
    ('shelter', 'abrigo'),
]


def fold(text):
    return address_search._strip_accents(text).lower()


def map_entry(uf):
    """Setup manifest map entry for a Brazilian state sourced via OpenStreetMap."""
    uf = str(uf or '').upper()
    info = BR_STATES.get(uf)
    if not info:
        return None
    name = info[0]
    return {
        'id': uf,
        'title': f'{name} ({uf})',
        'kind': 'state',
        'includes': 'Ruas, locais de emergência, municípios e busca de CEP/endereços via OpenStreetMap',
        'installed_bytes': 16_000_000,
        'download_bytes': 8_000_000,
        'available': True,
        'files': [],
        'osm_br': True,
    }


def _pack(parts):
    a = array('i', [len(parts)])
    for p in parts:
        n = len(p) // 2
        a.append(n)
        lx = ly = 0
        for i in range(n):
            x, y = int(round(p[2 * i] * _Q)), int(round(p[2 * i + 1] * _Q))
            a.append(x - lx)
            a.append(y - ly)
            lx, ly = x, y
    return a.tobytes()


def _bbox(parts):
    xs = [v for p in parts for v in p[0::2]]
    ys = [v for p in parts for v in p[1::2]]
    return min(xs), max(xs), min(ys), max(ys)


def _area_z(minx, maxx, miny, maxy, base):
    size = max(maxx - minx, maxy - miny)
    if size <= 0:
        return 17
    return max(base, min(16, int(math.log2(360 / size)) - 4))


def _fetch_bytes(url, limit=32 << 20, timeout=30, fetch_fn=None, allowed=None, context=None):
    if fetch_fn is not None:
        try:
            return fetch_fn(url, limit=limit, allowed=allowed, context=context, timeout=timeout)
        except TypeError:
            return fetch_fn(url)
    return download.fetch_small(url, limit=limit, allowed=allowed, context=context, timeout=timeout)


def _fetch_json(url, timeout=30, fetch_fn=None, allowed=None, context=None):
    data = _fetch_bytes(url, limit=32 << 20, timeout=timeout, fetch_fn=fetch_fn, allowed=allowed, context=context)
    if not data:
        return None
    try:
        return json.loads(data.decode('utf-8', 'replace'))
    except ValueError:
        return None


def _tag_poi_class(tags):
    if not tags:
        return None
    for k in ('amenity', 'shop', 'healthcare', 'natural', 'leisure', 'tourism', 'emergency'):
        v = tags.get(k)
        if not v:
            continue
        if v == 'pharmacy' or (k == 'healthcare' and v == 'pharmacy'):
            return 'pharmacy'
        if v in ('clinic', 'doctors', 'health_post') or (k == 'healthcare' and v in ('clinic', 'centre', 'doctor')):
            return 'clinic'
        if v == 'hospital':
            return 'hospital'
        if v == 'fire_station':
            return 'fire_station'
        if v == 'police':
            return 'police'
        if v in _POI_KEEP:
            return v
    return None


def _copy_base_map_files(current_lib, staged_lib):
    """Preserve base map layers from current_lib into staged_lib so install.swap_map keeps them."""
    if not current_lib:
        return []
    current_lib = Path(current_lib)
    kept = []
    copy_rels = [
        'derived/geo/national.sqlite',
        'derived/geo/water.sqlite',
        'derived/geo/terrain.sqlite',
        'derived/geo/buildings.sqlite',
        'derived/geo/crops.sqlite',
        'library-data/geography/resources/atlas.sqlite',
    ]
    for rel in copy_rels:
        src = current_lib / rel
        if src.is_file():
            dst = staged_lib / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            kept.append(rel)
    for json_rel, fallback in (
        ('derived/geo/national-status.json', '{"state":"complete","stage":"ready","features":0}'),
        ('derived/geo/socal-cells.json', '[]'),
    ):
        src = current_lib / json_rel
        dst = staged_lib / json_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_file():
            shutil.copy2(src, dst)
        else:
            dst.write_text(fallback, encoding='utf-8')
        kept.append(json_rel)
    return kept


def build_state_map(uf, current_lib, staged_lib, progress_cb=None, control=None, fetch_fn=None, allowed=None, context=None):
    """Download OpenStreetMap vector data and emergency POIs for a Brazilian state into staged_lib."""
    uf = str(uf or '').upper()
    info = BR_STATES.get(uf)
    if not info:
        raise install.Refused('unpack', f'Estado inválido: {uf}')
    state_name, capital, cap_lat, cap_lon, st_bbox = info
    staged_lib = Path(staged_lib)
    geo = staged_lib / 'derived' / 'geo'
    geo.mkdir(parents=True, exist_ok=True)
    res_dir = staged_lib / 'library-data' / 'geography' / 'resources'
    res_dir.mkdir(parents=True, exist_ok=True)

    def tick(done):
        if control is not None:
            control.check()
        if progress_cb:
            progress_cb(done, 100, 'downloading')

    tick(5)
    # Copy base files first so swap_map/replace_map_in preserves terrain/national layers.
    _copy_base_map_files(current_lib, staged_lib)
    for json_rel, fallback in (
        ('derived/geo/national-status.json', '{"state":"complete","stage":"ready","features":0}'),
        ('derived/geo/socal-cells.json', '[]'),
    ):
        dst = staged_lib / json_rel
        if not dst.is_file():
            dst.write_text(fallback, encoding='utf-8')

    tick(15)
    osm_data = None
    for delta in (0.006, 0.004, 0.0025):
        if control is not None:
            control.check()
        w, s, e, n = cap_lon - delta, cap_lat - delta, cap_lon + delta, cap_lat + delta
        url = f'https://www.openstreetmap.org/api/0.6/map.json?bbox={w:.4f},{s:.4f},{e:.4f},{n:.4f}'
        osm_data = _fetch_json(url, timeout=45, fetch_fn=fetch_fn, allowed=allowed, context=context)
        if osm_data and osm_data.get('elements'):
            break

    tick(40)
    poi_rows = []
    place_rows = []
    addr_rows = []
    seen_pois = set()
    seen_places = set()
    seen_addrs = set()

    def add_poi(cls, name, lon, lat):
        key = (cls, round(lon, 5), round(lat, 5), (name or '')[:40])
        if key not in seen_pois:
            seen_pois.add(key)
            poi_rows.append((cls, name or '', float(lon), float(lat)))

    def add_place(name, kind, detail, lat, lon, rank, source='OpenStreetMap'):
        if not name:
            return
        key = (name.lower(), round(float(lat), 4), round(float(lon), 4), kind)
        if key not in seen_places:
            seen_places.add(key)
            place_rows.append((name, kind, detail, float(lat), float(lon), rank, source))

    def add_addr(num, street, city, zc, lat, lon):
        st = (street or '').strip()
        nm = (num or '').strip()
        if not st or not nm:
            return
        z_clean = re.sub(r'\D', '', str(zc or ''))[:8]
        key = (nm.lower(), st.lower(), z_clean, round(float(lat), 5), round(float(lon), 5))
        if key not in seen_addrs:
            seen_addrs.add(key)
            addr_rows.append((nm, st, address_search.normalize(st), city or capital, uf, z_clean, float(lat), float(lon)))

    # Seed all 27 capitals so national search knows every UF capital offline too.
    for code, (st_n, cap_n, c_lat, c_lon, _) in BR_STATES.items():
        add_place(cap_n, 'city', f'{st_n} ({code})', c_lat, c_lon, 1 if code == uf else 2)
        add_place(st_n, 'state', f'Brasil ({code})', c_lat, c_lon, 1 if code == uf else 2)

    features = []
    min_lon, max_lon = cap_lon, cap_lon
    min_lat, max_lat = cap_lat, cap_lat
    got_network_data = bool(osm_data and osm_data.get('elements'))

    if osm_data and osm_data.get('elements'):
        elems = osm_data['elements']
        nodes = {el['id']: (float(el['lon']), float(el['lat'])) for el in elems if el.get('type') == 'node' and 'lon' in el and 'lat' in el}
        for el in elems:
            tags = el.get('tags') or {}
            etype = el.get('type')
            if etype == 'node' and el['id'] in nodes:
                lon, lat = nodes[el['id']]
                min_lon, max_lon = min(min_lon, lon), max(max_lon, lon)
                min_lat, max_lat = min(min_lat, lat), max(max_lat, lat)
                cls = _tag_poi_class(tags)
                if cls:
                    add_poi(cls, tags.get('name'), lon, lat)
                if tags.get('place') and tags.get('name'):
                    pcls = tags['place']
                    add_place(tags['name'], pcls, f'{capital}, {uf}', lat, lon, 2)
                    features.append(('place', pcls, tags['name'], 12, [[lon, lat]]))
                if tags.get('addr:street'):
                    if tags.get('addr:housenumber'):
                        add_addr(tags['addr:housenumber'], tags['addr:street'], tags.get('addr:city') or tags.get('addr:suburb') or capital, tags.get('addr:postcode') or '', lat, lon)
                    add_place(tags['addr:street'], 'Rua / Logradouro', f'{capital}, {uf}', lat, lon, 3)
                if tags.get('addr:postcode'):
                    cep = re.sub(r'\D', '', tags['addr:postcode'])
                    if len(cep) == 8:
                        cep_fmt = f'{cep[:5]}-{cep[5:]}'
                        add_place(cep_fmt, 'CEP', f"{tags.get('addr:street') or tags.get('addr:suburb') or capital}, {uf}", lat, lon, 2)
            elif etype == 'way':
                pts = [nodes[nid] for nid in (el.get('nodes') or []) if nid in nodes]
                if len(pts) < 2:
                    continue
                flat = [c for lo, la in pts for c in (lo, la)]
                b_w, b_e, b_s, b_n = _bbox([flat])
                min_lon, max_lon = min(min_lon, b_w), max(max_lon, b_e)
                min_lat, max_lat = min(min_lat, b_s), max(max_lat, b_n)
                c_lon = (b_w + b_e) / 2
                c_lat = (b_s + b_n) / 2
                cls = _tag_poi_class(tags)
                if cls:
                    add_poi(cls, tags.get('name'), c_lon, c_lat)
                    if tags.get('name'):
                        add_place(tags['name'], cls.replace('_', ' '), f'{capital}, {uf}', c_lat, c_lon, 4)
                if tags.get('addr:street'):
                    if tags.get('addr:housenumber'):
                        add_addr(tags['addr:housenumber'], tags['addr:street'], tags.get('addr:city') or tags.get('addr:suburb') or capital, tags.get('addr:postcode') or '', c_lat, c_lon)
                    add_place(tags['addr:street'], 'Rua / Logradouro', f'{capital}, {uf}', c_lat, c_lon, 3)
                if tags.get('addr:postcode'):
                    cep = re.sub(r'\D', '', tags['addr:postcode'])
                    if len(cep) == 8:
                        add_place(f'{cep[:5]}-{cep[5:]}', 'CEP', f"{tags.get('addr:street') or tags.get('addr:suburb') or capital}, {uf}", c_lat, c_lon, 2)
                if tags.get('highway'):
                    hw = tags['highway']
                    label = tags.get('name') or tags.get('ref')
                    features.append(('road', hw, label, _ROAD_Z.get(hw, 15), [flat]))
                    if tags.get('name'):
                        mid_lo, mid_la = pts[len(pts) // 2]
                        add_place(tags['name'], 'Rua / Logradouro', f'{capital}, {uf}', mid_la, mid_lo, 3)
                elif tags.get('railway'):
                    rc = tags['railway']
                    features.append(('rail', rc, tags.get('name'), 10 if rc == 'rail' else 13, [flat]))
                elif tags.get('waterway'):
                    wc = tags['waterway']
                    features.append(('waterway', wc, tags.get('name'), 10 if wc == 'river' else 13, [flat]))
                elif tags.get('building'):
                    if len(flat) >= 6:
                        features.append(('bldg', tags['building'], None, 15, [flat]))
                elif tags.get('natural') == 'water' or tags.get('water'):
                    if len(flat) >= 6:
                        features.append(('water', tags.get('water') or 'water', tags.get('name'), _area_z(b_w, b_e, b_s, b_n, 7), [flat]))
                elif tags.get('landuse') in _LANDUSE_KEEP or tags.get('leisure') == 'park':
                    lu = 'park' if tags.get('leisure') == 'park' else _LANDUSE_KEEP[tags['landuse']]
                    if len(flat) >= 6:
                        features.append(('land', lu, tags.get('name'), _area_z(b_w, b_e, b_s, b_n, 9), [flat]))

    # Query Nominatim on openstreetmap.org domain for broader state POIs (hospitals, UBS, fire stations, police, pharmacies, markets).
    step_base = 45
    step_span = 45
    total_q = len(_POI_QUERIES) + 1
    queries = [(cls, f'{term}, {capital}, {state_name}') for cls, term in _POI_QUERIES] + [('city', f'{capital}, {state_name}, Brasil')]
    for idx, (cls, qstr) in enumerate(queries):
        tick(step_base + int((idx / total_q) * step_span))
        url = (
            'https://nominatim.openstreetmap.org/search?'
            + urllib.parse.urlencode({'format': 'jsonv2', 'countrycodes': 'br', 'addressdetails': 1, 'limit': 35, 'q': qstr})
        )
        res = _fetch_json(url, timeout=20, fetch_fn=fetch_fn, allowed=allowed, context=context)
        if res is None:
            continue
        got_network_data = True
        for item in res:
            try:
                lat, lon = float(item['lat']), float(item['lon'])
            except (KeyError, TypeError, ValueError):
                continue
            addr = item.get('address') or {}
            st_code = str(addr.get('ISO3166-2-lvl4') or '').replace('BR-', '').upper()
            if st_code and st_code != uf:
                continue
            min_lon, max_lon = min(min_lon, lon), max(max_lon, lon)
            min_lat, max_lat = min(min_lat, lat), max(max_lat, lat)
            title = item.get('name') or (item.get('display_name') or '').split(',')[0].strip()
            city_n = addr.get('city') or addr.get('town') or addr.get('municipality') or capital
            if cls == 'city':
                add_place(title or city_n, item.get('type') or 'city', f'{state_name} ({uf})', lat, lon, 1)
            else:
                add_poi(cls, title, lon, lat)
                if title:
                    add_place(title, cls.replace('_', ' '), f'{city_n}, {uf}', lat, lon, 4)
            if addr.get('road'):
                add_place(addr['road'], 'Rua / Logradouro', f'{city_n}, {uf}', lat, lon, 3)
            if addr.get('suburb') or addr.get('neighbourhood'):
                add_place(addr.get('suburb') or addr.get('neighbourhood'), 'Bairro', f'{city_n}, {uf}', lat, lon, 3)
            if addr.get('postcode'):
                cep = re.sub(r'\D', '', addr['postcode'])
                if len(cep) == 8:
                    add_place(f'{cep[:5]}-{cep[5:]}', 'CEP', f"{addr.get('road') or city_n}, {uf}", lat, lon, 2)
        if control is not None:
            control.sleep(0.15)

    if not got_network_data:
        raise download.Failed(
            'network',
            f'Não foi possível baixar o mapa de {state_name} ({uf}) pelo OpenStreetMap. Verifique sua conexão e tente novamente.',
        )

    tick(92)
    # Write derived/geo/map.sqlite
    map_path = geo / 'map.sqlite'
    map_path.unlink(missing_ok=True)
    mdb = sqlite3.connect(map_path)
    mdb.executescript('''
      PRAGMA journal_mode=DELETE; PRAGMA synchronous=OFF;
      CREATE TABLE feat(id INTEGER PRIMARY KEY, layer TEXT, cls TEXT, name TEXT, minz INTEGER, geom BLOB);
      CREATE VIRTUAL TABLE feat_idx USING rtree(id, minx, maxx, miny, maxy, minz, maxz);
      CREATE TABLE poi(id INTEGER PRIMARY KEY, cls TEXT, name TEXT, lon REAL, lat REAL);
      CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
    ''')
    for fid, (layer, cls, name, minz, parts) in enumerate(features, 1):
        bx = _bbox(parts)
        mdb.execute('INSERT INTO feat VALUES (?,?,?,?,?,?)', (fid, layer, cls, name, minz, _pack(parts)))
        mdb.execute('INSERT INTO feat_idx VALUES (?,?,?,?,?,?,?)', (fid, *bx, minz, 30))
    for pid, (cls, name, lon, lat) in enumerate(poi_rows, 1):
        mdb.execute('INSERT INTO poi VALUES (?,?,?,?,?)', (pid, cls, name, lon, lat))
    mdb.execute('CREATE INDEX poi_cls ON poi(cls, lon, lat)')
    bounds_box = [min(st_bbox[0], min_lon), min(st_bbox[1], min_lat), max(st_bbox[2], max_lon), max(st_bbox[3], max_lat)]
    mdb.executemany('INSERT INTO meta VALUES (?,?)', [
        ('source', f'OpenStreetMap ({state_name} - {uf}), via https://www.openstreetmap.org/ (ODbL)'),
        ('state', uf),
        ('bounds', ','.join(f'{v:.4f}' for v in bounds_box)),
        ('built', time.strftime('%Y-%m-%dT%H:%M:%S')),
    ])
    mdb.commit()
    mdb.close()

    # Write derived/geo/places.sqlite (preserve existing non-OSM rows if present? Keeping Brazil OSM + all UF capitals keeps search clean and compact)
    places_path = geo / 'places.sqlite'
    places_path.unlink(missing_ok=True)
    pdb = sqlite3.connect(places_path)
    pdb.executescript('''
      PRAGMA journal_mode=DELETE; PRAGMA synchronous=OFF;
      CREATE TABLE place(id INTEGER PRIMARY KEY, name TEXT, kind TEXT, detail TEXT, lat REAL, lon REAL, rank INTEGER, source TEXT);
      CREATE VIRTUAL TABLE place_fts USING fts5(name, detail, content='place', content_rowid='id', tokenize='unicode61');
    ''')
    pdb.executemany(
        'INSERT INTO place(name,kind,detail,lat,lon,rank,source) VALUES (?,?,?,?,?,?,?)',
        place_rows,
    )
    pdb.execute("INSERT INTO place_fts(place_fts) VALUES ('rebuild')")
    pdb.commit()
    pdb.close()

    # Write derived/geo/addresses/<UF>.sqlite
    addr_dir = geo / 'addresses'
    addr_dir.mkdir(parents=True, exist_ok=True)
    addr_path = addr_dir / f'{uf}.sqlite'
    addr_path.unlink(missing_ok=True)
    adb = sqlite3.connect(addr_path)
    adb.executescript('''
      PRAGMA journal_mode=DELETE; PRAGMA synchronous=OFF;
      CREATE TABLE addr(num TEXT, street TEXT, norm TEXT, city TEXT, state TEXT, zip TEXT, lat REAL, lon REAL);
      CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
      CREATE INDEX addr_norm ON addr(norm, num);
      CREATE INDEX addr_num_norm ON addr(num, norm);
    ''')
    adb.executemany('INSERT INTO addr VALUES (?,?,?,?,?,?,?,?)', addr_rows)
    adb.executemany('INSERT INTO meta VALUES (?,?)', [
        ('state', uf),
        ('count', str(len(addr_rows))),
        ('source', 'OpenStreetMap (ODbL)'),
    ])
    adb.commit()
    adb.close()

    # Write map-set.json listing only files allowed by install.map_member (excludes derived/geo/addresses/*.sqlite).
    file_sizes = {}
    for p in sorted(staged_lib.rglob('*')):
        if p.is_file() and p.name != 'map-set.json':
            rel = p.relative_to(staged_lib).as_posix()
            if install.map_member(rel):
                file_sizes[rel] = p.stat().st_size
    map_set = {
        'name': uf,
        'files': file_sizes,
        'bytes': sum(file_sizes.values()),
        'seconds': 1,
    }
    (staged_lib / 'map-set.json').write_text(json.dumps(map_set, indent=1), encoding='utf-8')
    if progress_cb:
        progress_cb(100, 100, 'verifying')
    return staged_lib


def fetch_osm_tile(z, x, y, cache_dir):
    """Fetch an OpenStreetMap raster tile (cached locally under derived/cache/osm/)."""
    z, x, y = int(z), int(x), int(y)
    if not (0 <= z <= 19):
        return None
    n = 1 << z
    if not (0 <= x < n and 0 <= y < n):
        return None
    tile_file = Path(cache_dir) / 'osm' / str(z) / str(x) / f'{y}.png'
    try:
        if tile_file.is_file():
            return tile_file.read_bytes()
    except OSError:
        pass
    tile_key = (z, x, y)
    now = time.time()
    with _OSM_LOCK:
        fail_at = _TILE_FAIL.get(tile_key)
        if fail_at is not None and now - fail_at < 30:
            return None
    url = f'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'image/png,*/*'})
    ctx = ssl.create_default_context()
    try:
        with _OSM_SEM:
            if tile_file.is_file():
                return tile_file.read_bytes()
            with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
                if resp.status != 200:
                    return None
                data = resp.read(2 << 20)
        if not data or data[:4] != b'\x89PNG':
            return None
        tile_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = tile_file.with_suffix(f'.{threading.get_ident()}.tmp')
        tmp.write_bytes(data)
        os.replace(tmp, tile_file)
        with _OSM_LOCK:
            _TILE_FAIL.pop(tile_key, None)
        return data
    except (OSError, urllib.error.URLError, ValueError):
        with _OSM_LOCK:
            if len(_TILE_FAIL) >= 512:
                cutoff = time.time() - 30
                stale = [k for k, ts in _TILE_FAIL.items() if ts < cutoff]
                for k in stale:
                    _TILE_FAIL.pop(k, None)
                if len(_TILE_FAIL) >= 512:
                    _TILE_FAIL.pop(next(iter(_TILE_FAIL)), None)
            _TILE_FAIL[tile_key] = time.time()
        return None


def _ensure_cache_db(geo_dir):
    db_path = Path(geo_dir) / 'osm_places_cache.sqlite'
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(db_path)
    db.execute('CREATE TABLE IF NOT EXISTS cache(q TEXT PRIMARY KEY, res TEXT, ts REAL)')
    db.commit()
    return db


def _lookup_cached(geo_dir, key):
    db_path = Path(geo_dir) / 'osm_places_cache.sqlite'
    if not db_path.is_file():
        return None
    try:
        with _CACHE_LOCK:
            db = sqlite3.connect(ro_uri(db_path), uri=True)
            try:
                row = db.execute('SELECT res FROM cache WHERE q=?', (key,)).fetchone()
                return json.loads(row[0]) if row else None
            finally:
                db.close()
    except (OSError, sqlite3.Error, ValueError):
        return None


def _store_cached(geo_dir, key, results):
    try:
        with _CACHE_LOCK:
            db = _ensure_cache_db(geo_dir)
            try:
                db.execute('INSERT OR REPLACE INTO cache VALUES (?,?,?)', (key, json.dumps(results), time.time()))
                db.commit()
            finally:
                db.close()
    except (OSError, sqlite3.Error):
        pass


def _nominatim_kind(item):
    cls = item.get('class') or ''
    typ = item.get('type') or ''
    if typ == 'postcode':
        return 'CEP'
    if typ in ('house', 'building') or cls == 'place' and typ == 'house_number':
        return 'Endereço'
    if cls == 'highway':
        return 'Rua / Logradouro'
    if typ in ('suburb', 'neighbourhood', 'quarter'):
        return 'Bairro'
    if typ in ('city', 'town', 'municipality', 'administrative'):
        return 'Município / Cidade'
    return {
        'hospital': 'Hospital', 'clinic': 'Clínica / UBS', 'doctors': 'Posto de saúde',
        'pharmacy': 'Farmácia', 'fire_station': 'Corpo de Bombeiros', 'police': 'Polícia',
        'supermarket': 'Supermercado', 'fuel': 'Posto de combustível',
    }.get(typ, 'Local (OpenStreetMap)')


def _format_nominatim(item):
    try:
        lat, lon = float(item['lat']), float(item['lon'])
    except (KeyError, TypeError, ValueError):
        return None
    addr = item.get('address') or {}
    road = addr.get('road') or ''
    hnum = addr.get('house_number') or ''
    name = item.get('name') or (f'{road}, {hnum}' if road and hnum else road) or (item.get('display_name') or '').split(',')[0].strip()
    if not name:
        return None
    parts = [p for p in (addr.get('suburb') or addr.get('neighbourhood'), addr.get('city') or addr.get('town') or addr.get('municipality'), addr.get('state'), addr.get('postcode')) if p]
    detail = ', '.join(parts) or (item.get('display_name') or '')
    return {
        'name': name,
        'kind': _nominatim_kind(item),
        'detail': detail,
        'lat': lat,
        'lon': lon,
        'source': 'OpenStreetMap',
        'onMap': True,
    }


def search_places(query, geo_dir, limit=12, near=None):
    """Search Brazilian CEP (BrasilAPI + Nominatim), streets, house numbers and places via OpenStreetMap."""
    q = (query or '').strip()
    if not q:
        return []
    q_no_prefix = re.sub(r'^\s*cep\b[:\s-]*', '', q, flags=re.I).strip()
    m_cep = re.fullmatch(r'(\d{5})-?(\d{3})', q_no_prefix)
    near_cell = None
    if near is not None and not m_cep:
        try:
            near_cell = f'{round(float(near[0]), 1)},{round(float(near[1]), 1)}'
        except (TypeError, ValueError, IndexError):
            near_cell = None
    cache_key = f'{q.lower()}|{near_cell}' if near_cell else q.lower()
    cached = _lookup_cached(geo_dir, cache_key)
    if cached is not None:
        return cached[:limit]

    results = []
    ctx = None
    try:
        ctx = download.tls_context()
    except Exception:
        ctx = ssl.create_default_context()

    # Check if query is or contains an 8-digit Brazilian CEP (with optional house number, e.g. "01310-100" or "CEP 01310-100").
    if m_cep:
        cep = m_cep.group(1) + m_cep.group(2)
        cep_fmt = f'{m_cep.group(1)}-{m_cep.group(2)}'
        b_data = _fetch_json(f'https://brasilapi.com.br/api/cep/v2/{cep}', timeout=10, context=ctx)
        if b_data and not b_data.get('errors'):
            street = b_data.get('street') or ''
            neigh = b_data.get('neighborhood') or ''
            city = b_data.get('city') or ''
            uf = b_data.get('state') or ''
            coords = ((b_data.get('location') or {}).get('coordinates')) or {}
            lat, lon = coords.get('latitude'), coords.get('longitude')
            if (lat is None or lon is None) and (street or city):
                geo_q = ', '.join(x for x in (street, neigh, city, uf, 'Brasil') if x)
                nom_url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
                    {'format': 'jsonv2', 'countrycodes': 'br', 'addressdetails': 1, 'limit': 2, 'q': geo_q}
                )
                nom = _fetch_json(nom_url, timeout=10, context=ctx) or []
                if nom:
                    lat, lon = nom[0].get('lat'), nom[0].get('lon')
            if (lat is None or lon is None) and uf in BR_STATES:
                lat, lon = BR_STATES[uf][2], BR_STATES[uf][3]
            if lat is not None and lon is not None:
                title = f'CEP {cep_fmt}' + (f' — {street}' if street else '')
                detail = ', '.join(x for x in (neigh, city, uf) if x)
                results.append({
                    'name': title,
                    'kind': 'CEP',
                    'detail': detail,
                    'lat': float(lat),
                    'lon': float(lon),
                    'source': 'OpenStreetMap / BrasilAPI',
                    'onMap': True,
                })

    if not results:
        nom_q = q_no_prefix if m_cep else q
        params = {'format': 'jsonv2', 'countrycodes': 'br', 'addressdetails': 1, 'limit': min(limit, 10), 'q': nom_q}
        if near:
            params['viewbox'] = f'{near[1] - 1.5:.3f},{near[0] + 1.5:.3f},{near[1] + 1.5:.3f},{near[0] - 1.5:.3f}'
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params)
        nom_rows = _fetch_json(url, timeout=12, context=ctx) or []
        for item in nom_rows:
            fmt = _format_nominatim(item)
            if fmt:
                results.append(fmt)

    if results:
        _store_cached(geo_dir, cache_key, results)
    return results[:limit]

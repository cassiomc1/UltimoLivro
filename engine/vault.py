"""Cofre criptografado offline para documentos, fichas médicas e contatos de emergência da família.

Inspirado nas bóvedas criptográficas do refugiOS, adaptado para rodar de forma portátil
dentro da pasta da biblioteca (<LASTBOOK_DATA>/derived/vault) usando apenas primitivas
padrão de criptografia do Python (PBKDF2-HMAC-SHA256 + BLAKE2b stream + HMAC-SHA256).
"""
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import unicodedata
import zlib
from pathlib import Path

PBKDF2_ITERS = 250_000
ID_RE = re.compile(r'^[a-z0-9][a-z0-9_-]{0,63}$')
MAX_PAYLOAD_BYTES = 4 * 1024 * 1024


def vault_dir(data_dir=None):
    base = Path(data_dir) if data_dir else Path(os.environ.get('LASTBOOK_DATA') or '.')
    return base / 'derived' / 'vault'


def _now():
    return time.strftime('%Y-%m-%dT%H:%M:%S')


def _slug(name):
    norm = ''.join(ch for ch in unicodedata.normalize('NFKD', str(name or '')) if not unicodedata.combining(ch))
    s = re.sub(r'[^a-z0-9]+', '-', norm.lower()).strip('-')[:36]
    return (s or 'cofre') + '-' + secrets.token_hex(3)


def _atomic_write(p, env):
    p.parent.mkdir(parents=True, exist_ok=True)
    if os.name != 'nt':
        try:
            os.chmod(p.parent, 0o700)
        except OSError:
            pass
    tmp = p.with_name(f'.{p.name}.{secrets.token_hex(4)}.tmp')
    try:
        tmp.write_text(json.dumps(env, ensure_ascii=False), encoding='utf-8')
        if os.name != 'nt':
            try:
                os.chmod(tmp, 0o600)
            except OSError:
                pass
        os.replace(tmp, p)
    except Exception:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def _derive(password, salt):
    if not isinstance(password, str) or len(password) < 4:
        raise ValueError('A senha deve ter pelo menos 4 caracteres.')
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERS, dklen=64)
    return dk[:32], dk[32:]


def _keystream(enc_key, nonce, length):
    out = bytearray()
    ctr = 0
    while len(out) < length:
        out.extend(hashlib.blake2b(nonce + ctr.to_bytes(8, 'big'), key=enc_key, digest_size=64).digest())
        ctr += 1
    return bytes(out[:length])


def _encrypt(payload_dict, password):
    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(16)
    enc_key, mac_key = _derive(password, salt)
    raw = json.dumps(payload_dict, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    if len(raw) > MAX_PAYLOAD_BYTES:
        raise ValueError('O cofre excedeu o limite de tamanho permitido (4 MB).')
    comp = zlib.compress(raw, level=6)
    ks = _keystream(enc_key, nonce, len(comp))
    ct = bytes(a ^ b for a, b in zip(comp, ks))
    mac = hmac.new(mac_key, b'LASTBOOK-VAULT-V1' + salt + nonce + ct, hashlib.sha256).digest()
    return {
        'salt': base64.b64encode(salt).decode('ascii'),
        'nonce': base64.b64encode(nonce).decode('ascii'),
        'mac': base64.b64encode(mac).decode('ascii'),
        'data': base64.b64encode(ct).decode('ascii'),
    }


def _decrypt(envelope, password):
    if not isinstance(envelope, dict):
        raise ValueError('Arquivo do cofre corrompido ou formato inválido.')
    try:
        salt = base64.b64decode(envelope['salt'], validate=True)
        nonce = base64.b64decode(envelope['nonce'], validate=True)
        mac = base64.b64decode(envelope['mac'], validate=True)
        ct = base64.b64decode(envelope['data'], validate=True)
        if len(salt) != 16 or len(nonce) != 16 or len(mac) != 32:
            raise ValueError('Cabeçalho inválido.')
    except (KeyError, TypeError, ValueError, binascii.Error):
        raise ValueError('Arquivo do cofre corrompido ou formato inválido.')
    enc_key, mac_key = _derive(password, salt)
    expected = hmac.new(mac_key, b'LASTBOOK-VAULT-V1' + salt + nonce + ct, hashlib.sha256).digest()
    if not hmac.compare_digest(mac, expected):
        raise PermissionError('Senha incorreta ou arquivo do cofre adulterado.')
    ks = _keystream(enc_key, nonce, len(ct))
    comp = bytes(a ^ b for a, b in zip(ct, ks))
    try:
        return json.loads(zlib.decompress(comp).decode('utf-8'))
    except (zlib.error, ValueError, UnicodeDecodeError):
        raise ValueError('Arquivo do cofre corrompido ou formato inválido.')


def _vault_path(vault_id, data_dir=None):
    vid = str(vault_id or '')
    if not ID_RE.fullmatch(vid):
        raise ValueError('Identificador de cofre inválido.')
    return vault_dir(data_dir) / f'{vid}.lbvault'


def list_vaults(data_dir=None):
    d = vault_dir(data_dir)
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.glob('*.lbvault')):
        try:
            env = json.loads(p.read_text(encoding='utf-8'))
            if env.get('v') != 1:
                continue
            out.append({
                'id': env.get('id') or p.stem,
                'name': env.get('name') or p.stem,
                'created': env.get('created', ''),
                'updated': env.get('updated', ''),
                'bytes': p.stat().st_size,
            })
        except (OSError, ValueError):
            continue
    return out


def _read_envelope(p):
    try:
        env = json.loads(p.read_text(encoding='utf-8'))
    except ValueError:
        raise ValueError('Arquivo do cofre corrompido ou formato inválido.')
    if not isinstance(env, dict):
        raise ValueError('Arquivo do cofre corrompido ou formato inválido.')
    return env


def create_vault(name, password, data_dir=None):
    title = str(name or '').strip()[:80] or 'Cofre da Família'
    vid = _slug(title)
    now = _now()
    payload = {
        'name': title,
        'updated': now,
        'sections': {
            'documents': '',
            'medical': '',
            'contacts': '',
            'notes': '',
        },
        'attachments': [],
    }
    enc = _encrypt(payload, password)
    env = {'v': 1, 'id': vid, 'name': title, 'created': now, 'updated': now, **enc}
    p = _vault_path(vid, data_dir)
    _atomic_write(p, env)
    return {'id': vid, 'name': title, 'created': now, 'updated': now, 'payload': payload}


def open_vault(vault_id, password, data_dir=None):
    p = _vault_path(vault_id, data_dir)
    if not p.is_file():
        raise FileNotFoundError('Cofre não encontrado.')
    env = _read_envelope(p)
    payload = _decrypt(env, password)
    return {'id': env.get('id') or vault_id, 'name': env.get('name') or vault_id, 'created': env.get('created', ''), 'updated': env.get('updated', ''), 'payload': payload}


def save_vault(vault_id, password, payload, name=None, data_dir=None):
    p = _vault_path(vault_id, data_dir)
    if not p.is_file():
        raise FileNotFoundError('Cofre não encontrado.')
    env = _read_envelope(p)
    # Verifica a senha atual antes de sobrescrever.
    _decrypt(env, password)
    if not isinstance(payload, dict):
        raise ValueError('Conteúdo do cofre inválido.')
    sections = payload.get('sections')
    if sections is not None and not isinstance(sections, dict):
        raise ValueError('Seções do cofre inválidas.')
    now = _now()
    title = str(name or payload.get('name') or env.get('name') or vault_id).strip()[:80]
    clean_sec = {k: str((sections or {}).get(k) or '')[:200_000] for k in ('documents', 'medical', 'contacts', 'notes')}
    attachments = []
    for a in (payload.get('attachments') or [])[:20]:
        if isinstance(a, dict) and isinstance(a.get('name'), str) and isinstance(a.get('data_b64'), str):
            raw_size = a.get('size') or 0
            try:
                att_size = int(raw_size) if isinstance(raw_size, (int, float)) else 0
            except (TypeError, ValueError):
                att_size = 0
            attachments.append({
                'id': str(a.get('id') or secrets.token_hex(4))[:32],
                'name': a['name'][:120],
                'mime': str(a.get('mime') or 'application/octet-stream')[:80],
                'size': max(0, att_size),
                'data_b64': a['data_b64'],
            })
    clean_payload = {'name': title, 'updated': now, 'sections': clean_sec, 'attachments': attachments}
    enc = _encrypt(clean_payload, password)
    new_env = {'v': 1, 'id': env.get('id') or vault_id, 'name': title, 'created': env.get('created', now), 'updated': now, **enc}
    _atomic_write(p, new_env)
    return {'id': new_env['id'], 'name': title, 'created': new_env['created'], 'updated': now, 'payload': clean_payload}


def change_password(vault_id, current_password, new_password, data_dir=None):
    p = _vault_path(vault_id, data_dir)
    if not p.is_file():
        raise FileNotFoundError('Cofre não encontrado.')
    env = _read_envelope(p)
    payload = _decrypt(env, current_password)
    if not isinstance(payload, dict):
        raise ValueError('Conteúdo do cofre inválido.')
    now = _now()
    payload['updated'] = now
    enc = _encrypt(payload, new_password)
    title = str(env.get('name') or payload.get('name') or vault_id).strip()[:80]
    new_env = {'v': 1, 'id': env.get('id') or vault_id, 'name': title, 'created': env.get('created', now), 'updated': now, **enc}
    _atomic_write(p, new_env)
    return {'id': new_env['id'], 'name': title, 'created': new_env['created'], 'updated': now, 'payload': payload}


def delete_vault(vault_id, password, data_dir=None):
    p = _vault_path(vault_id, data_dir)
    if not p.is_file():
        raise FileNotFoundError('Cofre não encontrado.')
    env = _read_envelope(p)
    _decrypt(env, password)
    p.unlink()
    return {'ok': True, 'id': vault_id}

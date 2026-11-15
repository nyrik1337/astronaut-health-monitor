"""One explicitly synthetic request through a running FastAPI server and real Ollama.

Run: python backend/scripts/smoke_assistant.py --base-url http://127.0.0.1:8000
No mocking and no changes to stored data. Requires only Python's standard library.
"""

import argparse
import json
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    payload = {
        'subject_id': 'synthetic-smoke-crew', 'mode': 'simulation',
        'clock': {'kind': 'mission', 'id': 'synthetic-smoke-mission'},
        'as_of': '2026-11-14T10:00:00Z',
        'question': 'In this synthetic demo, what is known and unknown about fatigue? Is there a personal cognitive baseline?',
        'evidence': None, 'cognitive': None, 'gentle_breathing_available': False,
    }
    payload['evidence'] = {
        **{key: payload[key] for key in ('subject_id', 'mode', 'clock', 'as_of')},
        'reported_issue': {'code': 'fatigue', 'reported_at': payload['as_of'],
                           'source': {'kind': 'simulated', 'source_id': 'synthetic-smoke-fixture'}},
        'observations': [], 'notices': [],
    }
    request = urllib.request.Request(args.base_url.rstrip('/') + '/api/assistant/chat',
                                     data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json'})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=310) as response:
            result = json.load(response)
            status = response.status
    except urllib.error.HTTPError as exc:
        print(json.dumps({'http_status': exc.code, 'elapsed_seconds': round(time.monotonic()-started, 2),
                          'body': exc.read().decode()}, indent=2))
        return 1
    except urllib.error.URLError as exc:
        print('FastAPI server unavailable:', exc.reason)
        return 1
    print(json.dumps({'http_status': status, 'elapsed_seconds': round(time.monotonic()-started, 2),
                      'response': result}, indent=2, ensure_ascii=True))
    assert result['generation'] == 'local_ollama'
    assert result['mode'] == 'simulation' and result['provenance'] == 'synthetic_demonstration'
    assert result['evidence']['assessment_status'] == 'missing_data'
    assert result['cognitive'] is None and result['answer'].strip()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

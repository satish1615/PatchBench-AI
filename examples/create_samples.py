"""Regenerate original examples. No third-party dependencies."""
import json
import pathlib
import zipfile

ROOT=pathlib.Path(__file__).resolve().parent
BEFORE='''from config import RETRY_CODES
from errors import RetryExhausted

def fetch(session, url):
    response = session.get(url)
    return response

def is_ok(response):
    return response.status_code == 200
'''
AFTER='''from config import RETRY_CODES
from errors import RetryExhausted

def fetch(session, url):
    response = session.get(url)
    if response.status_code in RETRY_CODES:
        response = session.get(url)
    return response

def is_ok(response):
    return response.status_code == 200
'''
config='RETRY_CODES = (503,)\nMAX_ATTEMPTS = 2\n'
errors='class RetryExhausted(Exception):\n    pass\n'
retry="from types import SimpleNamespace\nfrom client import fetch\n\nclass FakeSession:\n    def __init__(self, statuses):\n        self.statuses = iter(statuses)\n        self.calls = 0\n\n    def get(self, url):\n        self.calls += 1\n        return SimpleNamespace(status_code=next(self.statuses))\n\ndef test_retries_on_503():\n    session = FakeSession([503, 200])\n    response = fetch(session, 'endpoint')\n    assert response.status_code == 200\n    assert session.calls == 2\n"
pass_tests="from types import SimpleNamespace\nfrom client import fetch\n\nclass FakeSession:\n    def __init__(self, statuses):\n        self.statuses = iter(statuses)\n        self.calls = 0\n\n    def get(self, url):\n        self.calls += 1\n        return SimpleNamespace(status_code=next(self.statuses))\n\ndef test_success():\n    session = FakeSession([200])\n    assert fetch(session, 'endpoint').status_code == 200\n    assert session.calls == 1\n\ndef test_unauthorized():\n    session = FakeSession([401])\n    assert fetch(session, 'endpoint').status_code == 401\n    assert session.calls == 1\n"
manifest={'schema_version':'1.0','task_id':'retry-policy-503','title':'Repair HTTP retry behavior','language':'python','context_items':['client.py','config.py','errors.py'],'targets':[{'path':'client.py','type':'function_body','symbol':'fetch'}],'tests':{'FAIL_TO_PASS':['tests/fail2pass/test_retry.py::test_retries_on_503'],'PASS_TO_PASS':['tests/pass2pass/test_client.py::test_success','tests/pass2pass/test_client.py::test_unauthorized']},'runner':{'offline':True}}
base={
 'states/before/client.py':BEFORE,'states/after/client.py':AFTER,
 'states/before/config.py':config,'states/after/config.py':config,
 'states/before/errors.py':errors,'states/after/errors.py':errors,
 'tests/fail2pass/test_retry.py':retry,'tests/pass2pass/test_client.py':pass_tests,
 'Dockerfile':'FROM python:3.12-slim\nRUN pip install --no-cache-dir pytest==8.3.5\nWORKDIR /work\nCOPY . .\n',
 'test.sh':'#!/bin/sh\nset -eu\nSTATE="${STATE:-after}"\ncase "$STATE" in before|after) ;; *) echo \'STATE must be before or after\' >&2; exit 2 ;; esac\nexport PYTHONPATH="$(pwd)/states/$STATE${PYTHONPATH:+:$PYTHONPATH}"\nif [ "$#" -eq 0 ]; then\n    python -m pytest -q tests/fail2pass tests/pass2pass\nelse\n    # Individual test IDs are comma separated. Shell splitting is deliberate.\n    old_IFS="$IFS"\n    IFS=\',\'\n    set -- $1\n    IFS="$old_IFS"\n    python -m pytest -q "$@"\nfi\n'
}

def write(name,entries):
  with zipfile.ZipFile(ROOT/name,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for filename,data in sorted(entries.items()):z.writestr(filename,data)

original=dict(base);original['task.json']=json.dumps(manifest,indent=2)+'\n';write('valid-task.zip',original)
broken=dict(base);bad=json.loads(json.dumps(manifest));bad['task_id']='retry-policy-broken';bad['title']='Broken retry-policy benchmark';bad['context_items']=['client.py','config.py'];bad['tests']['FAIL_TO_PASS']=['tests/fail2pass/test_retry.py'];bad['tests']['PASS_TO_PASS']=['tests/pass2pass/test_client.py::test_success'];broken['states/after/errors.py']='# formatter accidentally changed this file\n'+errors;broken['test.sh']='#!/bin/sh\npytest "$1"\n';broken['task.json']=json.dumps(bad,indent=2)+'\n';write('broken-task.zip',broken)
write('unsafe-traversal.zip',{'../secrets.txt':'do not trust this path','task.json':'{}'})
print('Sample archives regenerated')

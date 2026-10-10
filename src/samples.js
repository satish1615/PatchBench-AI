import {exampleTaskManifest} from './validator.js';
const clientBefore=`from config import RETRY_CODES\nfrom errors import RetryExhausted\n\ndef fetch(session, url):\n    response = session.get(url)\n    return response\n\ndef is_ok(response):\n    return response.status_code == 200\n`;
const clientAfter=`from config import RETRY_CODES\nfrom errors import RetryExhausted\n\ndef fetch(session, url):\n    response = session.get(url)\n    if response.status_code in RETRY_CODES:\n        response = session.get(url)\n    return response\n\ndef is_ok(response):\n    return response.status_code == 200\n`;
const config=`RETRY_CODES = (503,)\nMAX_ATTEMPTS = 2\n`;
const errors=`class RetryExhausted(Exception):\n    pass\n`;
const retryTests="from types import SimpleNamespace\nfrom client import fetch\n\nclass FakeSession:\n    def __init__(self, statuses):\n        self.statuses = iter(statuses)\n        self.calls = 0\n\n    def get(self, url):\n        self.calls += 1\n        return SimpleNamespace(status_code=next(self.statuses))\n\ndef test_retries_on_503():\n    session = FakeSession([503, 200])\n    response = fetch(session, 'endpoint')\n    assert response.status_code == 200\n    assert session.calls == 2\n";
const passTests="from types import SimpleNamespace\nfrom client import fetch\n\nclass FakeSession:\n    def __init__(self, statuses):\n        self.statuses = iter(statuses)\n        self.calls = 0\n\n    def get(self, url):\n        self.calls += 1\n        return SimpleNamespace(status_code=next(self.statuses))\n\ndef test_success():\n    session = FakeSession([200])\n    assert fetch(session, 'endpoint').status_code == 200\n    assert session.calls == 1\n\ndef test_unauthorized():\n    session = FakeSession([401])\n    assert fetch(session, 'endpoint').status_code == 401\n    assert session.calls == 1\n";
const docker=`FROM python:3.12-slim\nRUN pip install --no-cache-dir pytest==8.3.5\nWORKDIR /work\nCOPY . .\n`;
const script='#!/bin/sh\nset -eu\nSTATE="${STATE:-after}"\ncase "$STATE" in before|after) ;; *) echo \'STATE must be before or after\' >&2; exit 2 ;; esac\nexport PYTHONPATH="$(pwd)/states/$STATE${PYTHONPATH:+:$PYTHONPATH}"\nif [ "$#" -eq 0 ]; then\n    python -m pytest -q tests/fail2pass tests/pass2pass\nelse\n    # Individual test IDs are comma separated. Shell splitting is deliberate.\n    old_IFS="$IFS"\n    IFS=\',\'\n    set -- $1\n    IFS="$old_IFS"\n    python -m pytest -q "$@"\nfi\n';
export function makeSample(type='valid'){
 const metadata=structuredClone(exampleTaskManifest);
 const files={
  'states/before/client.py':clientBefore,'states/before/config.py':config,'states/before/errors.py':errors,
  'states/after/client.py':clientAfter,'states/after/config.py':config,'states/after/errors.py':errors,
  'tests/fail2pass/test_retry.py':retryTests,'tests/pass2pass/test_client.py':passTests,
  'Dockerfile':docker,'test.sh':script
 };
 if(type==='invalid'){
  metadata.task_id='retry-policy-broken'; metadata.title='Broken retry-policy benchmark';
  metadata.context_items=['client.py','config.py'];
  metadata.tests.FAIL_TO_PASS=['tests/fail2pass/test_retry.py'];
  metadata.tests.PASS_TO_PASS=['tests/pass2pass/test_client.py::test_success'];
  files['states/after/errors.py']='# formatter accidentally changed this file\n'+errors;
  files['test.sh']='#!/bin/sh\npytest "$1"\n';
 }
 files['task.json']=JSON.stringify(metadata,null,2)+'\n';
 return files;
}

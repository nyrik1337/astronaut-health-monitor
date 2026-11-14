"""Contract, deterministic analysis, transport, and complete demo regression checks."""

import copy
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import assessment_routes, main
from app.assessment_schemas import CognitiveRequest, EvidenceRequest
from app.assessment_validation import validate_assessment
from app.cognitive import analyze_cognitive
from app.evidence import assess_evidence

CONTRACT = (Path(__file__).resolve().parents[2] / 'docs/API_CONTRACT.md').read_text(encoding='utf-8')
EXTENSION = CONTRACT.split('## Additive extension:')[1]
EXAMPLES = [json.loads(s) for s in re.findall(r'```json\s*(.*?)\s*```', EXTENSION, re.S)]
NOW = datetime(2026, 11, 14, 10, 5, tzinfo=timezone.utc)
EVIDENCE = '/api/evidence/assess'
COGNITIVE = '/api/cognitive/analyze'


def iso(dt):
    return dt.isoformat(timespec='milliseconds' if dt.microsecond else 'seconds').replace('+00:00', 'Z')


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(assessment_routes, 'utc_now', lambda: NOW)
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def evidence():
    return copy.deepcopy(EXAMPLES[0])


@pytest.fixture
def cognitive():
    return copy.deepcopy(EXAMPLES[2])


def with_history(request):
    request = copy.deepcopy(request)
    start = datetime.fromisoformat(request['current_test']['started_at'].replace('Z', '+00:00'))
    request['history'] = []
    for i, value in enumerate([340, 330, 310, 320, 330]):
        session = copy.deepcopy(request['current_test'])
        session['session_id'] = f'prior-{i}'
        session['phase'] = 'familiarization' if i < 2 else 'measurement'
        session['started_at'] = iso(start - timedelta(days=6-i))
        session['ended_at'] = iso(start - timedelta(days=6-i) + timedelta(seconds=60))
        for t in session['trials']:
            t['reaction_time_ms'] = value
        request['history'].append(session)
    return request


def simulation(request):
    request = copy.deepcopy(request)
    request.update(subject_id='sim-crew-01', mode='simulation', clock={'kind': 'mission', 'id': 'mission-500'})
    for s in [request['current_test'], *request['history']]:
        s.update(subject_id=request['subject_id'], clock=request['clock'], source={'kind': 'simulated', 'source_id': 'mission-500'})
    return request


def assert_code(response, code, field=None):
    assert response.status_code == 422, response.text
    body = response.json()
    assert body['error']['code'] == 'VALIDATION_ERROR'
    assert any(d['code'] == code and (field is None or d['field'] == field) for d in body['error']['details']), body


@pytest.mark.parametrize('index,path', [(0, EVIDENCE), (2, COGNITIVE)])
def test_approved_examples(client, index, path):
    response = client.post(path, json=EXAMPLES[index])
    assert response.status_code == 200, response.text
    result, expected = response.json(), copy.deepcopy(EXAMPLES[index+1])
    # Contract explicitly makes prose illustrative; every structural/numeric field matches.
    for field in ('what_data_show', 'unknowns', 'limitations'):
        if field in expected:
            assert result[field]
            result.pop(field)
            expected.pop(field)
    assert result == expected


def test_approved_error_examples(client, evidence, cognitive):
    cognitive = with_history(cognitive)
    cognitive['history'][0]['source']['kind'] = 'simulated'
    assert client.post(COGNITIVE, json=cognitive).json() == EXAMPLES[4]
    evidence['observations'][0]['observed_at'] = '2026-11-14T10:00:00.001Z'
    assert client.post(EVIDENCE, json=evidence).json() == EXAMPLES[5]


@pytest.mark.parametrize('mode', ['real_assessment', 'simulation'])
def test_personal_arithmetic_and_statelessness(client, cognitive, mode):
    request = with_history(cognitive)
    if mode == 'simulation':
        request = simulation(request)
    result = client.post(COGNITIVE, json=request).json()
    assert result['analysis_status'] == 'analyzed'
    assert result['baseline'] == {'session_ids': ['prior-2', 'prior-3', 'prior-4'], 'median_reaction_time_ms': 320, 'signed_difference_ms': 50}
    assert [e['disposition'] for e in result['history_evaluation']] == ['familiarization']*2 + ['baseline']*3
    assert result['interpretation'] == ('synthetic_demonstration' if mode == 'simulation' else 'experimental_personal_summary')
    empty = copy.deepcopy(request)
    empty['history'] = []
    assert client.post(COGNITIVE, json=empty).json()['analysis_status'] == 'insufficient_history'
    assert client.post(COGNITIVE, json=request).json() == result


@pytest.mark.parametrize('kind,limit', [('heart_rate', 900), ('sleep_duration', 129600), ('cognitive_test', 86400)])
@pytest.mark.parametrize('delta,expected', [(0, 'available'), (.001, 'stale_data')])
def test_freshness_boundaries(evidence, kind, limit, delta, expected):
    evidence['observations'][0].update(kind=kind, value=8, observed_at=iso(datetime(2026,11,14,10,tzinfo=timezone.utc)-timedelta(seconds=limit+delta)))
    result = assess_evidence(EvidenceRequest.model_validate(evidence))
    assert next(i for i in result.evidence if i.kind == kind).status == expected


def test_all_issues_retained_and_null_not_zero(client, evidence):
    item = evidence['observations'][0]
    item.update(value=None, observed_at='2026-11-13T10:00:00Z', quality={'status': 'poor', 'reasons': ['sensor disconnected']})
    result = client.post(EVIDENCE, json=evidence).json()
    assert result['evidence'][0]['issues'] == ['missing_data', 'stale_data', 'poor_quality']
    assert result['evidence'][0]['status'] == 'missing_data'
    assert result['evidence'][0]['value'] is None
    assert result['evidence'][0]['source'] == item['source']


@pytest.mark.parametrize('stale,poor,expected', [(False,False,'complete'), (False,True,'poor_quality'), (True,False,'stale_data'), (True,True,'mixed')])
def test_overall_evidence_status(client, evidence, stale, poor, expected):
    template = evidence['observations'][0]
    evidence['observations'] = []
    for kind in ('heart_rate', 'sleep_duration', 'cognitive_test'):
        item = copy.deepcopy(template)
        item.update(kind=kind, value=8)
        if stale and (not poor or kind=='heart_rate'):
            item['observed_at'] = '2026-11-01T10:00:00Z'
        if poor:
            item['quality'] = {'status':'poor','reasons':['acquisition interruption']}
        evidence['observations'].append(item)
    assert client.post(EVIDENCE,json=evidence).json()['assessment_status'] == expected


@pytest.mark.parametrize('stamp', ['2026-11-14', '2026-11-14T10:00:00', '2026-02-30T10:00:00Z', '2026-11-14T10:00:60Z', '2026-11-14T10:00:00-00:00', '2026-11-14T10:00:00.0001Z', '2026-11-14t10:00:00z', '2026-11-14T10:00:00+24:00'])
def test_strict_timestamps(client, evidence, stamp):
    evidence['as_of'] = stamp
    assert_code(client.post(EVIDENCE,json=evidence),'INVALID_TIMESTAMP')


@pytest.mark.parametrize('delta,valid', [(-300,True),(300,True),(-300.001,False),(300.001,False)])
def test_real_clock_tolerance(client, cognitive, delta, valid):
    cognitive['as_of'] = iso(NOW + timedelta(seconds=delta))
    cognitive['current_test']['started_at']='2026-11-14T09:50:00Z'
    cognitive['current_test']['ended_at']='2026-11-14T09:51:00Z'
    response=client.post(COGNITIVE,json=cognitive)
    if valid:
        assert response.status_code==200
    else:
        assert_code(response,'AS_OF_OUT_OF_RANGE')


@pytest.mark.parametrize('source', ['simulated','human_entered','real_device','research_dataset'])
def test_real_history_provenance_rejected(client,cognitive,source):
    request=with_history(cognitive)
    request['history'][0]['source']={'kind':source,'source_id':'source-01'}
    assert_code(client.post(COGNITIVE,json=request),'PROVENANCE_MODE_MISMATCH')


def test_simulation_clock_and_source_isolation(client,cognitive):
    request=simulation(cognitive)
    request['as_of']='2099-01-01T00:00:00Z'
    assert client.post(COGNITIVE,json=request).status_code==200
    request['current_test']['source']['kind']='browser_measured'
    assert_code(client.post(COGNITIVE,json=request),'PROVENANCE_MODE_MISMATCH')
    request=simulation(cognitive)
    request['current_test']['clock']={'kind':'utc','id':'utc'}
    assert_code(client.post(COGNITIVE,json=request),'CLOCK_MISMATCH')


@pytest.mark.parametrize('field,value', [('setup_id','new'),('browser_version','132.0'),('browser_family','firefox'),('os_version','16.0'),('os_family','windows'),('device_class','desktop')])
def test_incompatible_history_excluded_not_rejected(client,cognitive,field,value):
    request=with_history(cognitive)
    request['history'][-1]['context'][field]=value
    result=client.post(COGNITIVE,json=request).json()
    assert result['analysis_status']=='insufficient_history'
    assert result['history_evaluation'][-1]['reasons']==['context_mismatch']


def test_patch_updates_and_leading_zeros_match(client,cognitive):
    request=with_history(cognitive)
    for s in request['history']:
        s['context'].update(browser_version='0131.99.1',os_version='015.0')
    assert client.post(COGNITIVE,json=request).json()['analysis_status']=='analyzed'


def test_familiarization_required_and_never_baseline(client,cognitive):
    request=with_history(cognitive)
    request['history'][1]['phase']='measurement'
    result=client.post(COGNITIVE,json=request).json()
    assert result['analysis_status']=='insufficient_history'
    assert all(e['reasons']==['familiarization_incomplete'] for e in result['history_evaluation'][1:])
    request=with_history(cognitive)
    request['current_test']['phase']='familiarization'
    result=client.post(COGNITIVE,json=request).json()
    assert result['issues']==['familiarization','insufficient_history']
    assert result['baseline'] is None


def test_history_age_independent_of_current_freshness(client,cognitive):
    request=with_history(cognitive)
    result=client.post(COGNITIVE,json=request).json()
    assert result['analysis_status']=='analyzed'  # Last baseline is two days old.
    start=datetime.fromisoformat(request['current_test']['started_at'].replace('Z','+00:00'))
    request['history'][0]['ended_at']=iso(start-timedelta(days=30))
    request['history'][0]['started_at']=iso(start-timedelta(days=30,seconds=60))
    assert client.post(COGNITIVE,json=request).json()['analysis_status']=='analyzed'
    request['history'][0]['ended_at']=iso(start-timedelta(days=30,milliseconds=1))
    result=client.post(COGNITIVE,json=request).json()
    assert result['history_evaluation'][0]['reasons']==['history_expired']
    assert result['baseline'] is None


@pytest.mark.parametrize('valid,expected', [(16,'analyzed'),(15,'poor_quality'),(0,'missing_data')])
def test_trial_quality_counts(client,cognitive,valid,expected):
    request=with_history(cognitive)
    for i,t in enumerate(request['current_test']['trials']):
        if i>=valid:
            t.update(outcome='early' if i%2 else 'missed',reaction_time_ms=None)
    result=client.post(COGNITIVE,json=request).json()
    assert result['analysis_status']==expected
    assert result['current']['valid_trials']==valid
    assert sum(result['current'][k] for k in ('valid_trials','early_responses','missed_responses'))==20


@pytest.mark.parametrize('interruption',['visibility_lost','window_blur','cancelled','held_key','scheduler_gap'])
def test_aborted_attempt_not_resumed(client,cognitive,interruption):
    request=with_history(cognitive)
    request['current_test'].update(completion='aborted',interruptions=[interruption])
    request['current_test']['trials']=request['current_test']['trials'][:19]
    result=client.post(COGNITIVE,json=request).json()
    assert result['analysis_status']=='poor_quality'
    assert result['current']['missed_responses']==0
    assert result['baseline'] is None


def test_full_precision_median_p90_and_signed_difference(cognitive):
    request=with_history(cognitive)
    for i,t in enumerate(request['current_test']['trials']):
        t['reaction_time_ms']=200.0004+i
    result=analyze_cognitive(CognitiveRequest.model_validate(request))
    assert result.current.median_reaction_time_ms==209.5
    assert result.current.p90_reaction_time_ms==217.0
    assert result.baseline.signed_difference_ms==-110.5


@pytest.mark.parametrize('path,index',[(EVIDENCE,0),(COGNITIVE,2)])
@pytest.mark.parametrize('bad',[True,'370',float('inf'),float('nan')])
def test_strict_finite_numbers(client,path,index,bad):
    request=copy.deepcopy(EXAMPLES[index])
    if index==0:
        request['observations'][0]['value']=bad
    else:
        request['current_test']['trials'][0]['reaction_time_ms']=bad
    response=client.post(path,content=json.dumps(request),headers={'Content-Type':'application/json'})
    assert response.status_code==422


@pytest.mark.parametrize('path,index',[(EVIDENCE,0),(COGNITIVE,2)])
def test_transport_limits_errors_cors_and_openapi(client,path,index):
    request=EXAMPLES[index]
    assert client.post(path,content='{',headers={'Content-Type':'application/json'}).status_code==400
    assert client.post(path,json=request,headers={'Content-Type':'text/plain'}).status_code==415
    body=json.dumps(request).encode()
    body+=b' '*(main.MAX_BODY_BYTES-len(body))
    assert client.post(path,content=body,headers={'Content-Type':'application/json'}).status_code==200
    assert client.post(path,content=body+b' ',headers={'Content-Type':'application/json'}).status_code==413
    response=client.post(path,json=request,headers={'Origin':'http://localhost:5173'})
    assert response.headers['access-control-allow-origin']=='http://localhost:5173'
    schema=client.get('/openapi.json').json()
    operation=schema['paths'][path]['post']
    assert operation['requestBody']['required'] is True
    assert '200' in operation['responses']


@pytest.mark.parametrize('path,index',[(EVIDENCE,0),(COGNITIVE,2)])
def test_unknown_required_fields_and_array_limits(client,path,index):
    request=copy.deepcopy(EXAMPLES[index])
    request['unapproved']=1
    assert_code(client.post(path,json=request),'UNKNOWN_FIELD')
    del request['unapproved']
    del request['mode']
    assert_code(client.post(path,json=request),'REQUIRED_FIELD')
    request=copy.deepcopy(EXAMPLES[index])
    notice={'id':'n','reported_at':request['as_of'],'source':{'kind':'simulated' if index==0 else 'human_entered','source_id':None},'text':'Unverified alert'}
    request['notices']=[notice]*17
    assert_code(client.post(path,json=request),'LIMIT_EXCEEDED')


def test_fatigue_cognitive_reassessment_integration(client,evidence,cognitive):
    evidence['notices']=[{'id':'n1','reported_at':evidence['as_of'],'source':{'kind':'simulated','source_id':None},'text':'Demonstration device alert'}]
    initial=client.post(EVIDENCE,json=evidence).json()
    assert initial['assessment_status']=='missing_data'
    assert initial['next_checks'][-1]['code']=='reaction_time_check'
    simulated=simulation(with_history(cognitive))
    result=client.post(COGNITIVE,json=simulated).json()
    assert result['interpretation']=='synthetic_demonstration'
    assert result['baseline']['signed_difference_ms']==50
    evidence['as_of']=simulated['as_of']
    evidence['observations'].append({'kind':'cognitive_test','observed_at':result['timestamp'],'value':result['current']['median_reaction_time_ms'],'source':{'kind':'simulated','source_id':'mission-500'},'quality':{'status':'acceptable','reasons':[]}})
    reassessed=client.post(EVIDENCE,json=evidence).json()
    assert reassessed['evidence'][2]['status']=='available'
    assert reassessed['next_checks']==[{'code':'sleep_check_in','optional':True}]
    assert reassessed['notices']==initial['notices']
    assert reassessed['notices'][0]['verification']=='unverified_client_input'
    real=client.post(COGNITIVE,json=cognitive).json()
    assert real['analysis_status']=='insufficient_history'
    assert real['baseline'] is None
    evidence['observations'][-1]['source']['kind']='browser_measured'
    assert_code(client.post(EVIDENCE,json=evidence),'PROVENANCE_MODE_MISMATCH')


def test_health_responds_while_calculation_waits(client,cognitive,monkeypatch):
    entered,release=threading.Event(),threading.Event()
    original=assessment_routes.analyze_cognitive
    def slow(payload):
        entered.set()
        assert release.wait(5)
        return original(payload)
    monkeypatch.setattr(assessment_routes,'analyze_cognitive',slow)
    with ThreadPoolExecutor() as pool:
        future=pool.submit(client.post,COGNITIVE,json=cognitive)
        try:
            assert entered.wait(5)
            assert client.get('/health').status_code==200
        finally:
            release.set()
        assert future.result().status_code==200


def set_path(obj, path, value):
    parts=path.split('.')
    for part in parts[:-1]:
        obj=obj[int(part)] if isinstance(obj,list) else obj[part]
    obj[int(parts[-1]) if isinstance(obj,list) else parts[-1]]=value


@pytest.mark.parametrize('path,value,code', [
    ('current_test.subject_id','someone-else','SUBJECT_MISMATCH'),
    ('current_test.clock.id','other-clock','CLOCK_MISMATCH'),
    ('clock.kind','mission','CLOCK_MISMATCH'),
    ('current_test.ended_at','2026-11-14T10:05:00.001Z','FUTURE_OBSERVATION'),
    ('current_test.started_at','2026-11-14T10:05:00.001Z','FUTURE_OBSERVATION'),
    ('current_test.ended_at','2026-11-14T10:02:59Z','INVALID_SESSION_INTERVAL'),
    ('current_test.ended_at','2026-11-14T10:03:12Z','INVALID_SESSION_INTERVAL'),
    ('current_test.started_at','2026-11-14T10:00:00Z','INVALID_SESSION_INTERVAL'),
    ('current_test.trials.0.index',2,'INVALID_TRIALS'),
    ('current_test.trials.0.index',True,'INVALID_TRIALS'),
    ('current_test.trials.0.wait_ms',999,'INVALID_TRIALS'),
    ('current_test.trials.0.wait_ms',3001,'INVALID_TRIALS'),
    ('current_test.trials.0.reaction_time_ms',99.999,'INVALID_TRIALS'),
    ('current_test.trials.0.reaction_time_ms',1500.001,'INVALID_TRIALS'),
    ('current_test.trials.0.reaction_time_ms',None,'INVALID_TRIALS'),
    ('current_test.trials.0.outcome','missed','INVALID_TRIALS'),
    ('current_test.interruptions',['window_blur'],'INVALID_TRIALS'),
    ('current_test.completion','aborted','INVALID_TRIALS'),
    ('current_test.context.browser_version','unknown','INVALID_VALUE'),
    ('current_test.context.os_version','','INVALID_VALUE'),
    ('current_test.source.verification','trusted','UNKNOWN_FIELD'),
    ('history.1.session_id','prior-0','DUPLICATE_ID'),
    ('history.1.ended_at','2026-11-08T10:04:00Z','DUPLICATE_TIMESTAMP'),
    ('history.1.ended_at','2026-11-07T10:04:00Z','TIMESTAMP_OUT_OF_ORDER'),
    ('history.4.ended_at','2026-11-14T10:03:00Z','TIMESTAMP_NOT_BEFORE_CURRENT'),
])
def test_cognitive_validation_rules(client,cognitive,path,value,code):
    request=with_history(cognitive)
    set_path(request,path,value)
    assert_code(client.post(COGNITIVE,json=request),code)


@pytest.mark.parametrize('path,value,code', [
    ('observations.0.value',0,'INVALID_VALUE'),
    ('observations.0.quality.status','poor','INVALID_VALUE'),
    ('observations.0.quality.reasons',['problem'],'INVALID_VALUE'),
    ('observations.0.source.kind','browser_measured','PROVENANCE_MODE_MISMATCH'),
    ('reported_issue.reported_at','2026-11-14T10:00:00.001Z','FUTURE_OBSERVATION'),
    ('reported_issue.source.kind','human_entered','PROVENANCE_MODE_MISMATCH'),
    ('clock.kind','utc','CLOCK_MISMATCH'),
])
def test_evidence_validation_rules(client,evidence,path,value,code):
    set_path(evidence,path,value)
    assert_code(client.post(EVIDENCE,json=evidence),code)


def test_duplicate_observation_and_context_restriction(client,evidence,cognitive):
    evidence['observations']*=2
    assert_code(client.post(EVIDENCE,json=evidence),'DUPLICATE_OBSERVATION')
    observation=copy.deepcopy(evidence['observations'][0])
    observation.update(kind='cognitive_test',source={'kind':'browser_measured','source_id':None})
    cognitive['context_observations']=[observation]
    assert_code(client.post(COGNITIVE,json=cognitive),'INVALID_VALUE')


@pytest.mark.parametrize('body',[None,[],42,'text'])
@pytest.mark.parametrize('path',[EVIDENCE,COGNITIVE])
def test_non_object_json(client,path,body):
    response=client.post(path,content=json.dumps(body),headers={'Content-Type':'application/json'})
    assert_code(response,'INVALID_VALUE')


def test_history_and_trial_limits(client,cognitive):
    request=with_history(cognitive)
    request['history']*=21
    assert_code(client.post(COGNITIVE,json=request),'LIMIT_EXCEEDED')
    cognitive['current_test']['trials']*=2
    assert_code(client.post(COGNITIVE,json=cognitive),'LIMIT_EXCEEDED')


@pytest.mark.parametrize('delta,status',[(0,'insufficient_history'),(.001,'stale_data')])
def test_current_cognitive_freshness_boundary(client,cognitive,delta,status):
    end=NOW-timedelta(seconds=86400+delta)
    cognitive['current_test'].update(started_at=iso(end-timedelta(seconds=60)),ended_at=iso(end))
    response=client.post(COGNITIVE,json=cognitive)
    assert response.status_code==200,response.text
    assert response.json()['analysis_status']==status
    assert response.json()['timestamp']==iso(end)


def test_offset_instants_and_duplicate_end_times(client,cognitive,evidence):
    evidence['observations'][0]['observed_at']='2026-11-14T14:55:00.001+05:00'
    result=client.post(EVIDENCE,json=evidence).json()
    assert result['evidence'][0]['observed_at']=='2026-11-14T09:55:00.001Z'
    assert result['evidence'][0]['age_seconds']==299.999
    request=with_history(cognitive)
    request['history'][1]['ended_at']='2026-11-08T15:04:00+05:00'
    assert_code(client.post(COGNITIVE,json=request),'DUPLICATE_TIMESTAMP')


@pytest.mark.parametrize('state',['missing_data','stale_data','poor_quality','available'])
def test_notices_remain_unverified_for_all_evidence_states(client,evidence,state):
    evidence['notices']=[{'id':'n','reported_at':evidence['as_of'],'source':{'kind':'simulated','source_id':None},'text':'<b>Unverified device alert</b>'}]
    item=evidence['observations'][0]
    if state=='missing_data': item['value']=None
    if state=='stale_data': item['observed_at']='2026-01-01T00:00:00Z'
    if state=='poor_quality': item['quality']={'status':'poor','reasons':['sensor interrupted']}
    result=client.post(EVIDENCE,json=evidence).json()
    assert result['evidence'][0]['status']==state
    assert result['notices']==[dict(**evidence['notices'][0],verification='unverified_client_input')]


def test_cognitive_context_and_notice_limitations(client,cognitive):
    cognitive['notices']=[{'id':'n','reported_at':cognitive['as_of'],'source':{'kind':'human_entered','source_id':None},'text':'Participant report'}]
    cognitive['context_observations']=[{'kind':'sleep_duration','observed_at':cognitive['as_of'],'value':5.5,'source':{'kind':'human_entered','source_id':None},'quality':{'status':'unknown','reasons':[]}}]
    result=client.post(COGNITIVE,json=cognitive).json()
    assert result['context_observations'][0]['issues']==['quality_unknown']
    assert any('do not establish the cause' in text for text in result['limitations'])
    assert any('quality is unknown' in text for text in result['limitations'])
    assert result['notices'][0]['verification']=='unverified_client_input'


@pytest.mark.parametrize('path,name,index',[(EVIDENCE,'assess_evidence',0),(COGNITIVE,'analyze_cognitive',2)])
def test_safe_server_failure_and_cors(client,monkeypatch,path,name,index):
    def fail(_):
        raise RuntimeError('private data')
    monkeypatch.setattr(assessment_routes,name,fail)
    response=client.post(path,json=EXAMPLES[index],headers={'Origin':'http://localhost:5173'})
    assert response.status_code==500
    assert response.json()=={'error':{'code':'INTERNAL_ERROR','message':'The analysis could not be completed.','details':[]}}
    assert response.headers['access-control-allow-origin']=='http://localhost:5173'


@pytest.mark.parametrize('path',[EVIDENCE,COGNITIVE])
def test_chunked_size_limit(client,path):
    def chunks():
        yield b' ' * main.MAX_BODY_BYTES
        yield b' '
    response=client.post(path,content=chunks(),headers={'Content-Type':'application/json'})
    assert response.status_code==413


def test_openapi_extension_refs_resolve(client):
    schema=client.get('/openapi.json').json()
    def visit(node):
        if isinstance(node,dict):
            if '$ref' in node:
                target=schema
                for part in node['$ref'].removeprefix('#/').split('/'):
                    target=target[part]
            for value in node.values(): visit(value)
        elif isinstance(node,list):
            for value in node: visit(value)
    visit(schema)
    for name in ('EvidenceRequest','CognitiveRequest','Session','Observation'):
        assert schema['components']['schemas'][name]['additionalProperties'] is False


def test_semantic_validation_is_clock_injected(cognitive):
    payload=CognitiveRequest.model_validate(cognitive)
    assert validate_assessment(payload,NOW)==[]
    assert validate_assessment(payload,NOW+timedelta(seconds=301))[0]['code']=='AS_OF_OUT_OF_RANGE'


def test_real_fatigue_check_reassessment_without_synthetic_baseline(client, evidence, cognitive):
    evidence.update(subject_id=cognitive['subject_id'], mode='real_assessment',
                    clock=cognitive['clock'], as_of=cognitive['as_of'])
    evidence['reported_issue']['source'] = {'kind': 'human_entered', 'source_id': None}
    evidence['observations'][0]['source'] = {'kind': 'real_device', 'source_id': 'demo-device'}
    initial = client.post(EVIDENCE, json=evidence).json()
    assert initial['interpretation'] == 'evidence_inventory'
    assert initial['next_checks'][-1]['code'] == 'reaction_time_check'
    result = client.post(COGNITIVE, json=cognitive).json()
    assert result['analysis_status'] == 'insufficient_history'
    assert result['baseline'] is None
    evidence['observations'].append({
        'kind': 'cognitive_test', 'observed_at': result['timestamp'],
        'value': result['current']['median_reaction_time_ms'],
        'source': {'kind': 'browser_measured', 'source_id': None},
        'quality': {'status': 'acceptable', 'reasons': []},
    })
    response = client.post(EVIDENCE, json=evidence)
    assert response.status_code == 200
    reassessed = response.json()
    assert reassessed['evidence'][2]['status'] == 'available'
    assert reassessed['next_checks'] == [{'code': 'sleep_check_in', 'optional': True}]
    assert any('not proof' in text for text in reassessed['limitations'])

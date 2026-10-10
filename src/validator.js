/**
 * Static benchmark package validator. NO uploaded code is evaluated or executed.
 * Metadata format is documented in README.md and examples/valid/task.json.
 */
export const RULES = [
  {id:'PKG',title:'Package & metadata',description:'A well-formed task.json, uniquely named safe paths, supported target types, and matching metadata.'},
  {id:'CTX',title:'Context fidelity',description:'Every source file in states/before appears exactly once in context_items. Context must not invent paths.'},
  {id:'DIFF',title:'Repository state integrity',description:'No non-target file changes. Every declared target must actually change or introduce the intended file.'},
  {id:'REG',title:'Region precision',description:'For Python function_body edits, signatures and surrounding code stay byte-identical; anchor-based edits preserve everything outside unique anchor lines.'},
  {id:'TEST',title:'Regression test inventory',description:'Test references point to one exact Python/Go test; the PASS_TO_PASS inventory covers all tests defined in each listed file.'},
  {id:'RUN',title:'Offline-runner readiness',description:'Review Dockerfile/test.sh presence, network dependencies and nondeterministic test patterns. Tests are not executed.'}
];
const types=new Set(['function_body','replacement_region','whole_file','new_file']);
const languages=new Set(['python','go']);
export const isSafePath=(path)=> typeof path==='string' && path.length>0 && path.length<280 && !path.startsWith('/') && !path.includes('\\') && !path.includes('\0') && !path.split('/').some(x=>x==='..'||x==='.'||x==='') && !/^[a-zA-Z]:/.test(path);
function normalizeFiles(files){
  if(files instanceof Map) return Object.fromEntries(files);
  return files && typeof files==='object' && !Array.isArray(files)?files:{};
}
function canonicalText(value){return typeof value==='string'?value:new TextDecoder().decode(value)}
function sortedUnique(arr){return [...new Set(arr)].sort()}
function pyFunction(file,symbol){
  if(!/^[A-Za-z_]\w*$/.test(symbol))return {error:'Invalid Python function symbol'};
  const lines=file.match(/[^\n]*\n|[^\n]+$/g)||[];
  const matching=[]; let offset=0;
  for(let i=0;i<lines.length;i++){
    const match=lines[i].match(/^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    if(match && match[2]===symbol){
      const base=match[1].length; let end=i+1;
      while(end<lines.length){const line=lines[end];const trimmed=line.trim(); if(trimmed && !line.trimStart().startsWith('#') && (/^[ \t]*/.exec(line)[0].length <= base))break; end++}
      const headerEnd=offset+lines[i].length; const bodyEnd=lines.slice(0,end).join('').length;
      matching.push({start:offset,headerEnd,bodyEnd,header:lines[i],body:file.slice(headerEnd,bodyEnd)});
    }
    offset+=lines[i].length;
  }
  if(matching.length!==1)return {error:`Expected exactly one definition of ${symbol}, found ${matching.length}`};
  return matching[0];
}
function compareFunctionBody(before,after,symbol){
 const b=pyFunction(before,symbol),a=pyFunction(after,symbol);if(b.error||a.error)return {ok:false,detail:b.error||a.error};
 const reconstruction=before.slice(0,b.headerEnd)+a.body+before.slice(b.bodyEnd);
 return {ok:reconstruction===after,detail:reconstruction===after?'Only the declared Python function body changed':'Code outside the declared function body changed, or the function signature differs'};
}
function compareRegion(before,after,region){
  if(!region || typeof region.start_anchor!=='string'||typeof region.end_anchor!=='string' || !region.start_anchor || !region.end_anchor) return {ok:false,detail:'Provide non-empty start_anchor and end_anchor'};
  function locate(text,anchor){const first=text.indexOf(anchor);if(first<0||text.indexOf(anchor,first+anchor.length)>=0)return -1;return first}
  const sb=locate(before,region.start_anchor),sa=locate(after,region.start_anchor),eb=locate(before,region.end_anchor),ea=locate(after,region.end_anchor);
  if([sb,sa,eb,ea].some(x=>x<0)||eb<sb+region.start_anchor.length||ea<sa+region.start_anchor.length)return {ok:false,detail:'Anchors must each occur exactly once and in the correct order in both states'};
  const beforeOutside=[before.slice(0,sb+region.start_anchor.length),before.slice(eb)];
  const afterOutside=[after.slice(0,sa+region.start_anchor.length),after.slice(ea)];
  const ok=beforeOutside[0]===afterOutside[0]&&beforeOutside[1]===afterOutside[1];
  return {ok,detail:ok?'Changes are confined between unchanged unique anchor boundaries':'Changes were found outside the requested anchor boundaries'};
}
function listTests(source,language){
 if(language==='python')return sortedUnique([...source.matchAll(/^\s*(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)\s*\(/gm)].map(x=>x[1]));
 return sortedUnique([...source.matchAll(/^func\s+(Test[A-Za-z0-9_]+)\s*\(\s*t\s+\*testing\.T\s*\)/gm)].map(x=>x[1]));
}
function compareValues(a,b){return a===b}
function resultFinding(level,code,title,detail,category){return {level,code,title,detail,category}}
export function validateTask(input){
 const files=normalizeFiles(input);const findings=[];const differences=[];
 const add=(level,code,title,detail,category)=>findings.push(resultFinding(level,code,title,detail,category));
 const paths=Object.keys(files).sort();
 for(const path of paths){if(!isSafePath(path))add('error','PKG-001','Unsafe file path',`Rejected unsafe archive path: ${path}`,'PKG')}
 let manifest;
 if(!Object.hasOwn(files,'task.json'))add('error','PKG-002','Missing task.json','Package root requires a task.json metadata file.','PKG');
 else {try{manifest=JSON.parse(canonicalText(files['task.json']))}catch(e){add('error','PKG-003','Invalid task.json',`JSON parsing failed: ${e.message}`,'PKG')}}
 if(!manifest || typeof manifest!=='object'||Array.isArray(manifest))manifest={};
 if(typeof manifest.task_id!=='string'||!manifest.task_id.trim())add('error','PKG-004','Missing task identifier','Set a non-empty task_id in task.json.','PKG');
 if(!languages.has(manifest.language))add('error','PKG-005','Unsupported language','Set language to python or go.','PKG');
 const before=paths.filter(x=>x.startsWith('states/before/')).map(x=>x.slice('states/before/'.length));
 const after=paths.filter(x=>x.startsWith('states/after/')).map(x=>x.slice('states/after/'.length));
 const allSources=sortedUnique([...before,...after]);
 if(!before.length||!after.length)add('error','PKG-006','Missing repository states','Both states/before/ and states/after/ need source files.','PKG');
 const contexts=manifest.context_items;
 if(!Array.isArray(contexts)||contexts.some(x=>typeof x!=='string'))add('error','CTX-001','Invalid context_items','context_items must contain all relative source paths in states/before/.','CTX');
 else {
   const missing=before.filter(x=>!contexts.includes(x));const extra=contexts.filter(x=>!before.includes(x));
   if(missing.length)add('error','CTX-002','Missing context files',`Add to context_items: ${missing.join(', ')}`,'CTX');
   if(extra.length)add('error','CTX-003','Unknown context files',`Remove paths absent from before/: ${extra.join(', ')}`,'CTX');
   if(new Set(contexts).size!==contexts.length)add('error','CTX-004','Duplicate context paths','Each context path must appear once.','CTX');
   if(!missing.length&&!extra.length&&new Set(contexts).size===contexts.length)add('pass','CTX-005','Context inventory matches',`All ${before.length} before-state paths are accounted for.`,'CTX');
 }
 const targets=manifest.targets;const validTargets=[];
 if(!Array.isArray(targets)||targets.length===0)add('error','REG-001','No edit targets','Declare at least one target in targets[].','REG');
 else for(const [i,target] of targets.entries()){
  if(!target || !isSafePath(target.path) || !types.has(target.type)){add('error','REG-002','Invalid target',`targets[${i}] needs a safe path and supported type.`,'REG');continue}
  if(validTargets.some(x=>x.path===target.path)){add('error','REG-003','Duplicate target path',`${target.path} is targeted more than once.`,'REG');continue}
  validTargets.push(target);
 }
 const byPath=new Map(validTargets.map(x=>[x.path,x]));
 for(const path of allSources){
   const inBefore=before.includes(path),inAfter=after.includes(path);
   const b=inBefore?canonicalText(files[`states/before/${path}`]):undefined;
   const a=inAfter?canonicalText(files[`states/after/${path}`]):undefined;
   const status=!inBefore?'added':!inAfter?'deleted':compareValues(b,a)?'unchanged':'changed';
   const target=byPath.get(path); differences.push({path,status,target:Boolean(target)});
   if(!target){if(status!=='unchanged')add('error','DIFF-001','Unapproved file change',`${path} is ${status}, but it is not declared as an edit target.`,'DIFF');continue}
   if(target.type==='new_file'){
    if(inBefore||!inAfter)add('error','REG-004','Invalid new_file target',`${path} must be absent from before/ and present in after/.`,'REG');
    else add('pass','REG-005','New file is correctly declared',`${path} exists only in the after state.`,'REG');
    continue;
   }
   if(!inBefore||!inAfter){add('error','REG-006','Target missing in one state',`${path} requires both before/ and after/ for ${target.type}.`,'REG');continue}
   if(status==='unchanged'){add('error','DIFF-002','Target has no change',`${path} is declared as a target but is byte-identical in both states.`,'DIFF');continue}
   if(target.type==='whole_file')add('pass','REG-007','Whole-file target is valid',`${path} changed as declared.`,'REG');
   if(target.type==='function_body'){
      if(manifest.language!=='python')add('warning','REG-008','Go function-body check unsupported','For Go choose whole_file or replacement_region; this parser validates Python function bodies.','REG');
      else if(!target.symbol||typeof target.symbol!=='string')add('error','REG-009','Missing function symbol',`${path} requires a symbol for function_body.`,'REG');
      else{const chk=compareFunctionBody(b,a,target.symbol);add(chk.ok?'pass':'error','REG-010',chk.ok?'Function body boundaries preserved':'Function body boundary mismatch',`${path}: ${chk.detail}`,'REG');}
   }
   if(target.type==='replacement_region'){
     const chk=compareRegion(b,a,target.region);add(chk.ok?'pass':'error','REG-011',chk.ok?'Anchor region is valid':'Anchor region mismatch',`${path}: ${chk.detail}`,'REG');
   }
 }
 for(const target of validTargets){if(!allSources.includes(target.path))add('error','REG-012','Target path absent',`${target.path} does not exist in either state.`,'REG')}
 if(!findings.some(x=>x.code==='DIFF-001')&&allSources.length)add('pass','DIFF-003','Non-target files preserved','Every non-target file is byte-identical in before/ and after/.','DIFF');
 const tests=manifest.tests;
 if(!tests || !Array.isArray(tests.FAIL_TO_PASS)||!Array.isArray(tests.PASS_TO_PASS))add('error','TEST-001','Incomplete test inventory','tests.FAIL_TO_PASS and tests.PASS_TO_PASS must both be arrays.','TEST');
 else {
  const entries=[...tests.FAIL_TO_PASS.map(x=>({kind:'FAIL_TO_PASS',ref:x})),...tests.PASS_TO_PASS.map(x=>({kind:'PASS_TO_PASS',ref:x}))];
  if(!tests.FAIL_TO_PASS.length||!tests.PASS_TO_PASS.length)add('error','TEST-002','Empty regression suite','Specify named tests in both fail-to-pass and pass-to-pass groups.','TEST');
  const seenRefs=new Set();
  for(const {kind,ref} of entries){
    if(typeof ref!=='string'||!/^tests\/(fail2pass|pass2pass)\/[\w./-]+\.(?:py|go)::(?:test_[A-Za-z0-9_]+|Test[A-Za-z0-9_]+)$/.test(ref)){
      add('error','TEST-003','Malformed test reference',`${String(ref)} must use tests/<suite>/<file>::<exact_test_name>.`,'TEST');continue;
    }
    if(seenRefs.has(ref))add('error','TEST-004','Duplicate test reference',`${ref} appears more than once.`,'TEST');seenRefs.add(ref);
    const [file,name]=ref.split('::');
    if((kind==='FAIL_TO_PASS'&&!file.startsWith('tests/fail2pass/'))||(kind==='PASS_TO_PASS'&&!file.startsWith('tests/pass2pass/')))add('error','TEST-005','Test suite mismatch',`${ref} is listed in the wrong suite.`,'TEST');
    if(!Object.hasOwn(files,file)){add('error','TEST-006','Test file missing',`Missing ${file} in ZIP.`,'TEST');continue}
    const found=listTests(canonicalText(files[file]),manifest.language);
    if(!found.includes(name))add('error','TEST-007','Named test missing',`${name} is not defined in ${file}. Found: ${found.join(', ')||'none'}.`,'TEST');
  }
  const passFiles=sortedUnique(paths.filter(x=>x.startsWith('tests/pass2pass/')&&(/\.(py|go)$/.test(x))));
  for(const file of passFiles){const names=listTests(canonicalText(files[file]),manifest.language);const refs=new Set(tests.PASS_TO_PASS.filter(x=>typeof x==='string'));
    const missing=names.filter(name=>!refs.has(`${file}::${name}`));
    if(missing.length)add('error','TEST-008','Unlisted preservation tests',`${file} defines test(s) absent from PASS_TO_PASS: ${missing.join(', ')}`,'TEST');
  }
  if(!findings.some(x=>x.level==='error'&&x.category==='TEST')&&entries.length)add('pass','TEST-009','Test inventory resolves',`${entries.length} named test references matched files and declarations.`,'TEST');
 }
 if(!Object.hasOwn(files,'Dockerfile'))add('warning','RUN-001','Dockerfile missing','Add a pinned, self-contained Dockerfile for repeatable offline testing.','RUN');
 else {
   const docker=canonicalText(files.Dockerfile);
   if(!/^FROM\s+/m.test(docker))add('warning','RUN-002','Dockerfile missing base image','Declare a Docker base image.','RUN');
   else add('pass','RUN-003','Docker base image declared','A Dockerfile with FROM was found.','RUN');
   if(manifest.language==='python'&&!/\bpytest\b/.test(docker))add('warning','RUN-004','Pytest not installed in image','Install pytest during image build; offline test containers cannot fetch dependencies.','RUN');
 }
 if(!Object.hasOwn(files,'test.sh'))add('warning','RUN-005','Test script missing','Include test.sh to document and reproduce suite invocation.','RUN');
 else {
   const script=canonicalText(files['test.sh']);
   if(/pytest\s+["']\$1["']/.test(script))add('warning','RUN-006','Comma-separated test IDs not split','A runner receiving comma-separated test names must split the input before passing them to pytest.','RUN');
   if(/go\s+test\s+[^\n]*_test\.go\b/.test(script))add('warning','RUN-007','Go test called with file path','Run go test on the package directory and anchor the -run pattern to an exact test name.','RUN');
   if(!/^#!.*\b(?:ba)?sh\b/m.test(script))add('warning','RUN-008','Shell interpreter unspecified','Add a bash/sh shebang to test.sh.','RUN');
 }
 for(const path of paths.filter(x=>x.startsWith('tests/') && /\.(?:py|go)$/.test(x))){const code=canonicalText(files[path]);
  if(/https?:\/\/|\brequests\.(?:get|post)\s*\(|\bhttp\.Get\s*\(/.test(code))add('warning','RUN-009','Potential external network dependency',`${path} contains a network call or URL. Prefer local fakes.`,'RUN');
  if(/\brandom\.(?:choice|random|randint)\s*\(|time\.perf_counter\(\)|time\.sleep\(/.test(code))add('warning','RUN-010','Potentially nondeterministic test',`${path} uses timing or unseeded randomness. Prefer deterministic assertions.`,'RUN');
 }
 const nError=findings.filter(x=>x.level==='error').length;
 const nWarn=findings.filter(x=>x.level==='warning').length;
 const nPass=findings.filter(x=>x.level==='pass').length;
 add('warning','RUN-011','Execution not verified','Static analysis cannot prove that FAIL_TO_PASS fails on before/ or passes on after/. Verify both states in an isolated offline runner.','RUN');
 return {
  version:'1.1',task_id:manifest.task_id||'unnamed-task',title:manifest.title||manifest.task_id||'Unnamed benchmark task',language:manifest.language||'unknown',
  status:nError?'needs-fixes':'structurally-valid',summary:{errors:nError,warnings:nWarn+1,passed:nPass,files:allSources.length,tests:Array.isArray(tests?.FAIL_TO_PASS)&&Array.isArray(tests?.PASS_TO_PASS)?tests.FAIL_TO_PASS.length+tests.PASS_TO_PASS.length:0},
  findings,differences,checked_at:new Date().toISOString(),scope:'static-analysis-only'
 };
}
export const exampleTaskManifest={schema_version:'1.0',task_id:'retry-policy-503',title:'Repair HTTP retry behavior',language:'python',context_items:['client.py','config.py','errors.py'],targets:[{path:'client.py',type:'function_body',symbol:'fetch'}],tests:{FAIL_TO_PASS:['tests/fail2pass/test_retry.py::test_retries_on_503'],PASS_TO_PASS:['tests/pass2pass/test_client.py::test_success','tests/pass2pass/test_client.py::test_unauthorized']},runner:{offline:true}};

import {validateTask,RULES,exampleTaskManifest} from './src/validator.js';
import {unzipTask} from './src/zip.js';
import {makeSample} from './src/samples.js';
import {reportAsMarkdown} from './src/report.js';
const $=(s)=>document.querySelector(s);
const $$=(s)=>Array.from(document.querySelectorAll(s));
let lastReport=null;let currentName='';let currentFilter='all';const sessionHistory=[];
const escapeHTML=(s)=>String(s??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function navigate(view){
 $$('.view').forEach(el=>el.classList.toggle('is-active',el.id===view));
 $$('.nav-item').forEach(btn=>{const active=btn.dataset.view===view;btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current')});
 $('#crumb').textContent=({dashboard:'Overview',validator:'Task validator',standards:'Validation rules',history:'Session history'})[view];
 window.scrollTo({top:0,behavior:'instant'});
 if(view==='history')renderHistory();
}
$$('[data-view]').forEach(el=>el.addEventListener('click',(event)=>{event.preventDefault();navigate(el.dataset.view)}));
$$('[data-action]').forEach(el=>el.addEventListener('click',async ()=>{
  switch(el.dataset.action){case 'open-validator':navigate('validator');break;case 'load-valid':await loadDemo('valid');break;case 'load-invalid':await loadDemo('invalid');break;}
}));
function showPackage(name,files){$('#package-information').hidden=false;$('#package-information').textContent=`Loaded: ${name} · ${Object.keys(files).length} entries`;}
async function loadDemo(type){const files=makeSample(type);renderReport(validateTask(files),type==='valid'?'Reference example':'Broken example',files)}
const input=$('#zip-input');
const zone=$('#dropzone');
zone.addEventListener('click',()=>input.click());
zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}});
for(const type of ['dragenter','dragover'])zone.addEventListener(type,e=>{e.preventDefault();zone.classList.add('drag-over')});
for(const type of ['dragleave','drop'])zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove('drag-over')});
zone.addEventListener('drop',async e=>{const file=e.dataTransfer?.files?.[0];if(file)await loadFile(file)});
input.addEventListener('change',async ()=>{const file=input.files?.[0];if(file)await loadFile(file);input.value=''});
async function loadFile(file){
 navigate('validator');
 if(!file.name.toLowerCase().endsWith('.zip'))return showLoadError('Choose a .zip benchmark archive.');
 if(file.size>12*1024*1024)return showLoadError('ZIP archive exceeds the 12 MB limit.');
 zone.setAttribute('aria-busy','true');
 try{const files=await unzipTask(file);renderReport(validateTask(files),file.name,files)}
 catch(e){showLoadError(e.message)}finally{zone.removeAttribute('aria-busy')}
}
function showLoadError(message){
 $('#empty-state').hidden=false;$('#results').hidden=true;
 $('#empty-state').innerHTML=`<div class="empty-symbol" style="background:#fff0e9;color:#c05d48">!</div><h2>Could not open package</h2><p>${escapeHTML(message)}</p><button class="btn btn-primary" data-error-action="sample">Try a sample instead ↗</button>`;
 $('[data-error-action="sample"]').addEventListener('click',()=>loadDemo('valid'));
}
function renderReport(report,name,files){
 lastReport=report;currentName=name;currentFilter='all';navigate('validator');showPackage(name,files);
 $('#empty-state').hidden=true;$('#results').hidden=false;
 $('#task-title').textContent=report.title;
 $('#task-subtitle').textContent=`${name} · ${report.language.toUpperCase()} · ${report.task_id}`;
 const badge=$('#report-badge');badge.className='report-badge '+(report.status==='structurally-valid'?'good':'bad');badge.textContent=report.status==='structurally-valid'?'✓ Structure valid':'! Needs fixes';
 $('#stat-errors').textContent=report.summary.errors;$('#stat-warnings').textContent=report.summary.warnings;
 $('#stat-checks').textContent=report.summary.passed;$('#stat-files').textContent=report.summary.files;
 $$('.filter').forEach(el=>el.classList.toggle('active',el.dataset.filter==='all'));
 renderFindings();renderChanges();
 sessionHistory.unshift({name,title:report.title,time:new Date(),status:report.status,errors:report.summary.errors,warnings:report.summary.warnings});
 if(sessionHistory.length>12)sessionHistory.pop();
}
function renderFindings(){
 if(!lastReport)return;
 const list=lastReport.findings.filter(f=>currentFilter==='all'||f.level===currentFilter);
 $('#findings-count').textContent=lastReport.findings.length;
 $('#findings-list').innerHTML=list.length?list.map(f=>`<div class="finding ${escapeHTML(f.level)}"><span class="finding-symbol">${{error:'×',warning:'!',pass:'✓'}[f.level]}</span><div><strong>${escapeHTML(f.title)}</strong><p>${escapeHTML(f.detail)}</p><span class="finding-tag">${escapeHTML(f.code)} · ${escapeHTML(f.category)}</span></div></div>`).join(''):`<div class="history-empty" style="padding:25px">No ${escapeHTML(currentFilter)} findings in this report.</div>`;
}
function renderChanges(){
 $('#changes-list').innerHTML=lastReport.differences.length?lastReport.differences.map(f=>`<div class="file-row"><span class="file-marker ${escapeHTML(f.status)}">${{added:'+',deleted:'−',changed:'~',unchanged:'='}[f.status]}</span><code>${escapeHTML(f.path)}</code><small>${f.target?'TARGET':escapeHTML(f.status.toUpperCase())}</small></div>`).join(''):'<div class="history-empty" style="padding:15px">No source files discovered.</div>';
}
$$('.filter').forEach(btn=>btn.addEventListener('click',()=>{currentFilter=btn.dataset.filter;$$('.filter').forEach(el=>el.classList.toggle('active',el===btn));renderFindings()}));
function downloadFile(name,content,mime){const link=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type:mime}));link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#download-json').addEventListener('click',()=>lastReport&&downloadFile(`${lastReport.task_id}-patchbench-report.json`,JSON.stringify(lastReport,null,2),'application/json'));
$('#download-md').addEventListener('click',()=>lastReport&&downloadFile(`${lastReport.task_id}-patchbench-report.md`,reportAsMarkdown(lastReport),'text/markdown'));
$('#download-spec').addEventListener('click',()=>downloadFile('task.json',JSON.stringify(exampleTaskManifest,null,2)+'\n','application/json'));
$('#standards-grid').innerHTML=RULES.map((r,i)=>`<article class="standard"><span class="standard-num">RULE ${String(i+1).padStart(2,'0')} / ${escapeHTML(r.id)}</span><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.description)}</p></article>`).join('');
function renderHistory(){
 $('#history-content').innerHTML=sessionHistory.length?sessionHistory.map(x=>`<div class="history-entry"><div><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.name)} · ${escapeHTML(x.time.toLocaleTimeString())} · ${x.errors} errors, ${x.warnings} warnings</small></div><span class="report-badge ${x.status==='structurally-valid'?'good':'bad'}">${x.status==='structurally-valid'?'Valid':'Needs fixes'}</span></div>`).join(''):'<div class="history-empty">No validations yet. Open a sample to get started.</div>';
}
$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
// Respect deep links without letting the hash introduce unknown dynamic content.
const deep=(location.hash||'').slice(1);if(['dashboard','validator','standards','history'].includes(deep))navigate(deep);

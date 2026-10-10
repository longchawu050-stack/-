import './style.css';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PHOTO_BUCKET } from './config.js';
/* ---------- Scale definition (from 校园建筑鸟撞 5 分钟快速筛查量表 v1.0) ---------- */
const STEPS=['info','photos','A','B','C','D','K','N','M','F','review'];
const STEP_NAMES={info:'基本信息',photos:'照片',A:'A 玻璃量',B:'B 错觉',C:'C 几何/曲面',D:'D 鸟类暴露',K:'完整有效防护',N:'夜间灯光 N',M:'碰撞证据',F:'飞穿红旗',review:'确认保存'};
const F={
 A:{code:'A',w:2,name:'未防护危险玻璃的面积与连续性',tip:'先从玻璃总量中剔除已核实有效防护的面积，再按最危险可见状态打分。',
   opts:[['无','或整个单元均已核实有效处理'],['少于立面约 1/4','主要为被实体墙分隔的小窗'],['约 1/4–1/2','或有连续窗带、成组落地窗'],['超过约 1/2','或为多跨、跨层连续幕墙']]},
 B:{code:'B',w:3,name:'视觉欺骗强度',tip:'反射与通透取较高值，不相加。在外侧约 5–20 m，从正面及左右斜角观察，按当次最危险可见状态打分。',
   opts:[['明显是实体','无有意义的反射或通视'],['反射弱、模糊或破碎','视线很快被墙、窗帘截断'],['局部清楚映出天空/树木','或能透视到亮室内、第二层玻璃'],['大面积镜面般天空/植被/水体','或可直看至室外天空、植被、亮口']]},
 C:{code:'C',w:2,name:'空间构型与曲面放大',tip:'曲率本身不自动加分。只有曲面扩大接近方向、连续呈现虚假栖息地，或形成包围/导流时才提高 C；反射清晰度只记在 B。',
   opts:[['单一平面','曲面未扩大接近方向，也未形成通道'],['倾斜、凸曲面或折面','暴露于更多方向，但不包围、不导流'],['透明转角、深凹槽、凹曲面或 L/U 形','形成环绕反射或导向'],['对置/平行玻璃、玻璃连廊、中庭','透明栏板/风挡，或明显飞穿漏斗']]},
 D:{code:'D',w:2,name:'鸟类暴露与吸引背景',tip:'看真实环境，不看倒影。观察约 30 m 内的植被、水体和鸟活动；不能仅凭“有树”判高危。',
   opts:[['硬质地面为主','约 30 m 内无明显鸟活动或吸引物'],['草坪、零散灌木或少量小树','鸟活动少'],['成片灌木、成熟树木、花园或水体','可观察到鸟使用'],['林缘、绿廊、水岸、果树/花源/投喂','或固定停栖点，且频繁穿飞']]},
 K:{code:'防护',name:'完整有效防护',tip:'只有整面外侧高对比图案（横竖空隙均 ≤5 cm），或外置网/格栅等实际阻隔，才选“是”。部分处理通过 A 项反映。防护近照可用银行卡短边（约 5.4 cm）作间距参照。',
   opts:[['否 / 不确定','未核验整面有效防护'],['是','整面已核验有效防护，快速筛查指数记为 0']]},
 N:{code:'N',name:'夜间灯光',tip:'白天无法判断时选“未观察”，夜间复查，不能填 0。N ≥ 2 只提高监测优先级，不直接改结构风险等级。',allowNull:true,
   opts:[['暗 / 遮光',''],['少量或短时',''],['大范围亮窗 / 较晚',''],['中庭 / 外投光 / 通宵','']]},
 M:{code:'证据',name:'碰撞证据',tip:'没发现鸟尸不等于无鸟撞。',
   opts:[['无可靠记录',''],['一次','一次死伤鸟、羽粉撞痕或可靠人员报告 → 至少“高”'],['重复','同点重复或一个迁徙季 ≥2 次 → 直接“极高”']]},
 F:{code:'飞穿',name:'明显飞穿红旗',tip:'针对未处理的透明转角、连廊、平行玻璃、长透明屏障等。',
   opts:[['无',''],['有明显通视','→ 至少“高”'],['通视至天空 / 植被','远端同时可见天空或植被 → 直接“极高”']]}
};
const ORIENT=['北','东北','东','东南','南','西南','西','西北','水平/采光顶'];
const WEATHER=['晴','多云','阴','小雨','雾霾'];
const LIGHT=['顺光','逆光','侧光','阴影中','夜间'];
const OBSTYPE=['白天初评','换光照复核','夜间复查','迁徙季抽查'];
const PHOTO_KINDS=['正面全景','斜角反射/通视','周边环境','防护近照','其他'];
const LEVELS=['极高','高','中','低'];
const LV_RANK={'极高':4,'高':3,'中':2,'低':1,'待补充':0};

function compute(r){
  if(['A','B','C','D','K','M','F'].some(k=>typeof r[k]!=='number')) return {index:null,level:'待补充',advice:'补齐评分项',flags:[]};
  const index=r.K===1?0:2*r.A+3*r.B+2*r.C+2*r.D;
  const flags=[];let level;
  if(r.M===2||r.F===2||(r.K===0&&r.A===3&&r.B===3)){
    level='极高';
    if(r.M===2)flags.push('碰撞证据为“重复”，直接极高');
    if(r.F===2)flags.push('飞穿通视至天空/植被，直接极高');
    if(r.K===0&&r.A===3&&r.B===3)flags.push('未防护，且 A、B 均为 3 分，直接极高');
  }else if(r.M===1||r.F===1){
    level=index>=19?'极高':'高';
    if(r.M===1)flags.push('已有一次碰撞证据，至少为高');
    if(r.F===1)flags.push('存在明显飞穿通视，至少为高');
  }else level=index<=5?'低':index<=11?'中':index<=18?'高':'极高';
  if(r.K===1)flags.push('整面已核验有效防护，指数记为 0');
  let advice=r.M===2?'重复碰撞记录':r.F===2?'飞穿直达天空/植被':r.M===1?'已有碰撞证据':r.F===1?'未处理明显飞穿':
    level==='极高'?'优先监测并制定处理方案':level==='高'?'系统监测和改造候选':level==='中'?'换时段复核/迁徙季抽查':'记录';
  advice+=typeof r.N!=='number'?'；夜间未评估':r.N>=2?'；夜间优先级+1':'';
  return {index,level,advice,flags};
}

/* ---------- Storage: Supabase when configured, this browser's storage otherwise ---------- */
const S={mode:'connecting',sb:null,records:[],readOnly:false,error:''};
const LS_KEY='bg-records-v1',DRAFT_KEY='bg-draft-v1';
function lsGet(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}

// record field <-> table column
const COLS_MAP={pointId:'point_id',building:'building',facade:'facade',orientation:'orientation',datetime:'observed_at',
  weather:'weather',light:'light',observer:'observer',obsType:'obs_type',A:'a',B:'b',C:'c',D:'d',K:'k',N:'n',M:'m',F:'f',
  index:'risk_index',level:'risk_level',advice:'advice',confidence:'confidence',photoNo:'photo_no',notes:'notes',photos:'photos',
  createdAt:'created_at',updatedAt:'updated_at'};
function toRow(rec){const row={};for(const [k,c] of Object.entries(COLS_MAP))if(rec[k]!==undefined)row[c]=rec[k];return row}
function fromRow(row){const rec={id:row.id};for(const [k,c] of Object.entries(COLS_MAP))rec[k]=row[c];
  ['facade','orientation','weather','light','observer','obsType','confidence','photoNo','notes'].forEach(k=>{if(rec[k]==null)rec[k]=''});
  rec.photos=Array.isArray(rec.photos)?rec.photos:[];return rec}
const isConfigured=()=>/^https:\/\//.test(SUPABASE_URL||'')&&(SUPABASE_ANON_KEY||'').length>20;
const photoUrl=path=>`${String(SUPABASE_URL).replace(/\/$/,'')}/storage/v1/object/public/${PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
const newId=()=>(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)}));

let reloadTimer=null;
async function reload(){
  const {data,error}=await S.sb.from('records').select('*').order('updated_at',{ascending:false});
  if(error){S.error=error.message;console.error(error)}else{S.error='';S.records=data.map(fromRow)}
  if(V.view!=='wizard')render();
}
const reloadSoon=()=>{clearTimeout(reloadTimer);reloadTimer=setTimeout(reload,400)};

async function initStore(){
  if(isConfigured()){
    S.sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);S.mode='db';
    await reload();
    // live updates from teammates (needs the table in the supabase_realtime publication, see schema.sql)
    S.sb.channel('records-live').on('postgres_changes',{event:'*',schema:'public',table:'records'},reloadSoon).subscribe();
    window.addEventListener('focus',reloadSoon);
  }else{
    S.mode='local';S.records=lsGet(LS_KEY,[]);
    if(V.view!=='wizard')render();
  }
}
async function uploadPhoto(blob){
  const d=new Date();const path=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}/${newId()}.jpg`;
  const {error}=await S.sb.storage.from(PHOTO_BUCKET).upload(path,blob,{contentType:blob.type||'image/jpeg',upsert:false});
  if(error)throw error;return path;
}
async function saveRecord(rec){
  rec=JSON.parse(JSON.stringify(rec));
  const c=compute(rec);rec.index=c.index;rec.level=c.level;rec.advice=c.advice;
  rec.updatedAt=new Date().toISOString();
  if(!rec.createdAt)rec.createdAt=rec.updatedAt;
  rec.photos=(rec.photos||[]).filter(p=>p.path||p.data).map(p=>p.path?{path:p.path,kind:p.kind}:{data:p.data,kind:p.kind});
  if(rec.N===undefined)rec.N=null;
  if(S.mode==='db'){
    const id=rec.id||newId();
    const row=toRow(rec);row.id=id;
    const {error}=await S.sb.from('records').upsert(row);
    if(error)throw error;
    await reload();return id;
  }else{
    const nid=rec.id||('r'+Date.now().toString(36));delete rec.id;
    const arr=S.records.filter(r=>r.id!==nid);arr.push(Object.assign({id:nid},rec));
    if(!lsSet(LS_KEY,arr))throw {code:'local_full',message:'浏览器存储已满'};
    S.records=arr;return nid;
  }
}
async function deleteRecord(r){
  if(S.mode==='db'){
    const {error}=await S.sb.from('records').delete().eq('id',r.id);
    if(error)throw error;
    const paths=(r.photos||[]).map(p=>p.path).filter(Boolean);
    if(paths.length)await S.sb.storage.from(PHOTO_BUCKET).remove(paths);
    await reload();
  }else{S.records=S.records.filter(x=>x.id!==r.id);lsSet(LS_KEY,S.records)}
}
const photoSrc=p=>p.url||(p.path?photoUrl(p.path):p.data);

/* ---------- View state ---------- */
const V={view:'list',filter:'全部',q:'',step:0,draft:null,detailId:null};
const app=document.getElementById('app'),layer=document.getElementById('layer');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nowLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function fmtDT(s){return s?String(s).replace('T',' '):''}
function localDT(iso){if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}

function render(){
  if(V.view==='wizard')return renderWizard();
  if(V.view==='detail')return renderDetail();
  renderList();
}

/* ---------- List ---------- */
function renderList(){
  const recs=S.records.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const counts={全部:recs.length};LEVELS.forEach(l=>counts[l]=recs.filter(r=>compute(r).level===l).length);
  const q=V.q.trim().toLowerCase();
  const shown=recs.filter(r=>(V.filter==='全部'||compute(r).level===V.filter)&&(!q||[r.building,r.pointId,r.facade,r.observer].join(' ').toLowerCase().includes(q)));
  // building level = highest unit level; ties broken by number of 高/极高 units
  const bmap={};recs.forEach(r=>{const b=r.building||'（未填建筑）';const c=compute(r);(bmap[b]=bmap[b]||{name:b,units:0,top:'待补充',hi:0});
    bmap[b].units++;if(LV_RANK[c.level]>LV_RANK[bmap[b].top])bmap[b].top=c.level;if(c.level==='高'||c.level==='极高')bmap[b].hi++;});
  const blds=Object.values(bmap).sort((a,b)=>LV_RANK[b.top]-LV_RANK[a.top]||b.hi-a.hi||a.name.localeCompare(b.name,'zh'));
  const canAdd=!S.readOnly&&S.mode!=='connecting';
  app.innerHTML=`
  <header class="hero"><div class="hero-in">
    <div><div class="eyebrow">校园建筑鸟撞 · 5 分钟快速筛查 v1.0</div><h1>鸟撞玻璃点位记录</h1>
    <p>每条记录对应一个同质玻璃风险单元。拍照、逐项打分、自动算出风险等级。</p></div>
    <div class="row">
      <button class="btn" data-a="export" ${recs.length?'':'disabled'}>导出 CSV</button>
      <button class="btn primary" data-a="new" ${canAdd?'':'disabled'}>＋ 新建记录</button>
    </div></div></header>
  ${S.mode==='local'?`<div class="banner">还没有配置 Supabase：记录只保存在这台设备的浏览器里。按 README 填写 config.js 后即可多人共享记录和照片。</div>`:''}
  ${S.mode==='connecting'?`<div class="banner">正在连接数据库…</div>`:''}
  ${S.error?`<div class="banner" style="background:var(--xhigh-bg)">数据库出错：${esc(S.error)}（检查 config.js，并确认已在 Supabase 执行 schema.sql）</div>`:''}
  <div class="stats">${['全部',...LEVELS].map(l=>`<button class="stat ${V.filter===l?'on':''}" data-a="filter" data-v="${l}"><b class="${l==='全部'?'':'lv-'+l}" style="background:none">${counts[l]}</b><span>${l==='全部'?'全部单元':l}</span></button>`).join('')}</div>
  ${blds.length?`<div class="section-h"><h2>建筑级风险</h2><small>取该建筑最高单元等级，不取平均</small></div>
  <div class="bld">${blds.map(b=>`<div class="bld-row"><span>${esc(b.name)}</span><span class="n mono">${b.units} 个单元${b.hi?` · 高及以上 ${b.hi}`:''}</span><span class="pill lv-${b.top}">${b.top}</span></div>`).join('')}</div>`:''}
  <div class="section-h"><h2>点位记录${V.filter!=='全部'?` · ${V.filter}`:''}</h2><small>${shown.length} 条</small></div>
  <input class="search" id="q" type="search" placeholder="搜索建筑、点位编号、立面或观察者" value="${esc(V.q)}">
  <div class="list">${shown.length?shown.map(cardHTML).join(''):emptyHTML(recs.length)}</div>`;
  const qi=document.getElementById('q');qi.oninput=e=>{V.q=e.target.value;const pos=e.target.selectionStart;renderList();const n=document.getElementById('q');n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}
}
function cardHTML(r){
  const c=compute(r);const p=(r.photos||[])[0];
  return `<button class="card" data-a="open" data-id="${esc(r.id)}">
    <div class="thumb">${p?`<img src="${esc(photoSrc(p))}" alt="" loading="lazy">`:'无照片'}</div>
    <div style="min-width:0"><h3>${esc(r.pointId||'未编号')} · ${esc(r.building||'未填建筑')}</h3>
    <div class="sub">${esc([r.facade,r.orientation].filter(Boolean).join(' · ')||'—')}</div>
    <div class="sub mono">${esc(fmtDT(r.datetime))}${r.observer?' · '+esc(r.observer):''}</div></div>
    <div class="right"><span class="pill lv-${c.level}">${c.level}</span><span class="mono" style="font-size:13px;color:var(--muted)">${c.index??'–'}<small>/27</small></span></div>
  </button>`;
}
function emptyHTML(total){
  if(total)return `<div class="empty"><b>没有符合条件的记录</b>换个筛选条件或清空搜索。</div>`;
  return `<div class="empty"><b>还没有记录</b>到达点位后点“新建记录”：填写建筑与立面，拍正面、斜角和周边环境照片，再依次给 A–D 四个因子和红旗项打分。<br><br>${S.mode==='connecting'?'':'<button class="btn primary" data-a="new">＋ 新建第一条记录</button>'}</div>`;
}

/* ---------- Wizard ---------- */
function newDraft(){return {building:'',pointId:'',facade:'',orientation:'',datetime:nowLocal(),weather:'',light:'',observer:lsGet('bg-observer',''),obsType:'白天初评',photos:[],confidence:'中',photoNo:'',notes:''}}
function persistDraft(){if(V.draft&&!V.draft.id)lsSet(DRAFT_KEY,Object.assign({},V.draft,{photos:V.draft.photos.filter(p=>p.path||p.data&&p.data.length<200000).map(p=>({path:p.path,kind:p.kind,data:p.data}))}))}
function stepValid(s,d){
  if(s==='info')return !!(d.building.trim()&&d.pointId.trim());
  if(s==='photos')return !d.photos.some(p=>p.busy);
  if(s==='N')return d.N!==undefined;
  if(F[s])return typeof d[s]==='number';
  return true;
}
function firstInvalid(d){for(let i=0;i<STEPS.length-1;i++)if(!stepValid(STEPS[i],d))return i;return -1}
function renderWizard(){
  const d=V.draft,s=STEPS[V.step];if(s==='review')V.backToReview=false;
  const segs=STEPS.map((k,i)=>`<button class="seg ${i===V.step?'cur':stepValid(k,d)&&k!=='review'&&(k!=='photos'||d.photos.length)?'done':''}" data-a="goto" data-v="${i}" aria-label="${STEP_NAMES[k]}"></button>`).join('');
  let body='';
  if(s==='info')body=infoHTML(d);else if(s==='photos')body=photosHTML(d);else if(s==='review')body=reviewHTML(d);else body=factorHTML(s,d);
  const last=s==='review';
  app.innerHTML=`<div class="wz-top"><div class="wz-top-in">
    <div class="wz-head"><button class="linkbtn" data-a="cancel">✕ ${d.id?'取消编辑':'退出'}</button>
    <span class="t"><b class="mono">${V.step+1}/${STEPS.length}</b> · ${STEP_NAMES[s]}</span></div>
    <div class="segs">${segs}</div></div></div>
    <div class="step">${body}</div>
    <div class="wz-bot"><div class="wz-bot-in">
      <button class="btn" data-a="prev" ${V.step===0?'disabled':''}>上一步</button>
      ${last?`<button class="btn primary" data-a="save" id="saveBtn">${d.id?'保存修改':'完成并保存'}</button>`
        :`<button class="btn primary" data-a="next" ${stepValid(s,d)?'':'disabled'}>${s==='N'&&d.N===undefined?'请选择':'下一步'}</button>`}
    </div></div>`;
  bindInfo();
  window.scrollTo(0,0);
}
function chipGroup(field,vals,cur){return `<div class="chips">${vals.map(v=>`<button class="chip ${cur===v?'on':''}" data-a="chip" data-f="${field}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`}
function infoHTML(d){
  const blds=[...new Set(S.records.map(r=>r.building).filter(Boolean))];
  return `<div class="step-h"><h2>点位基本信息</h2></div>
  <p class="tip">评估范围：同一方向、玻璃外观和构型基本一致的立面。连廊、转角、栏板、风挡、采光顶、凹槽和中庭单独评估。</p>
  <div class="grid2">
    <div class="field"><label for="f-building">建筑名称 <span class="req">*</span></label><input class="inp" id="f-building" data-f="building" list="bl" value="${esc(d.building)}" placeholder="如：第二教学楼"><datalist id="bl">${blds.map(b=>`<option value="${esc(b)}">`).join('')}</datalist></div>
    <div class="field"><label for="f-pointId">点位/立面编号 <span class="req">*</span></label><input class="inp" id="f-pointId" data-f="pointId" value="${esc(d.pointId)}" placeholder="如：JX2-S-01"></div>
  </div>
  <div class="field"><label for="f-facade">立面/特征</label><input class="inp" id="f-facade" data-f="facade" value="${esc(d.facade)}" placeholder="如：南立面一层连续落地窗"></div>
  <div class="field"><span class="lbl">朝向</span>${chipGroup('orientation',ORIENT,d.orientation)}</div>
  <div class="grid2">
    <div class="field"><label for="f-datetime">日期时间</label><input class="inp" id="f-datetime" type="datetime-local" data-f="datetime" value="${esc(d.datetime)}"></div>
    <div class="field"><label for="f-observer">观察者</label><input class="inp" id="f-observer" data-f="observer" value="${esc(d.observer)}" placeholder="姓名"></div>
  </div>
  <div class="field"><span class="lbl">天气</span>${chipGroup('weather',WEATHER,d.weather)}</div>
  <div class="field"><span class="lbl">光照</span>${chipGroup('light',LIGHT,d.light)}</div>
  <div class="field"><span class="lbl">观察类型</span>${chipGroup('obsType',OBSTYPE,d.obsType)}</div>`;
}
function photosHTML(d){
  const can=true;
  return `<div class="step-h"><h2>拍照 / 上传玻璃照片</h2></div>
  <p class="tip">至少拍正面全景、斜角反射/通视、周边环境；有防护的拍防护近照。可一次选多张，照片会自动压缩后上传。</p>
  ${can?`<div class="ph-add">${PHOTO_KINDS.map((k,i)=>`<label for="pf${i}">＋ ${k}<input id="pf${i}" type="file" accept="image/*" multiple data-kind="${k}"></label>`).join('')}</div>`
  :`<div class="banner">你当前的权限不能上传照片（需要编辑权限）。可以在“照片编号”里记录相机照片编号，其余评分照常保存。</div>`}
  <div class="ph-grid">${d.photos.map((p,i)=>`<div class="ph">${photoSrc(p)?`<img src="${esc(photoSrc(p))}" alt="${esc(p.kind)}" data-a="zoom" data-i="${i}">`:''}
    <span class="tag">${esc(p.kind)}</span>${p.busy?'<div class="busy">上传中…</div>':`<button class="x" data-a="rmphoto" data-i="${i}" aria-label="删除照片">×</button>`}</div>`).join('')}</div>
  ${d.photos.length?'':'<p class="hint" style="margin-top:12px">还没有照片。没有照片也可以继续，稍后在记录里编辑补传。</p>'}`;
}
function factorHTML(k,d){
  const f=F[k];const cur=d[k];
  const o=f.opts.map((op,v)=>`<button class="opt ${cur===v?'sel':''}" data-a="score" data-k="${k}" data-v="${v}">
    <span class="num">${v}${f.w?`<small>×${f.w}=${v*f.w}</small>`:''}</span>
    <span class="lab">${esc(op[0])}${op[1]?`<span class="desc">${esc(op[1])}</span>`:''}</span></button>`).join('');
  const nul=f.allowNull?`<button class="opt null ${cur===null?'sel':''}" data-a="score" data-k="${k}" data-v="null"><span class="num">空</span><span class="lab">未观察<span class="desc">白天无法判断，留空并标记“夜间待复查”</span></span></button>`:'';
  return `<div class="step-h"><span class="code">${f.code}</span><h2>${esc(f.name)}</h2>${f.w?`<span class="weight">权重 ×${f.w}</span>`:''}</div>
  <p class="tip">${esc(f.tip)}</p><div class="opts">${o}${nul}</div>`;
}
function resultHTML(r){
  const c=compute(r);const pct=c.index==null?0:c.index/27*100;
  return `<div class="result">
    <div class="res-top"><div><div class="hint">快速筛查指数 R = 2A + 3B + 2C + 2D</div><div class="res-idx">${c.index??'–'}<small> / 27</small></div></div>
    <span class="pill res-lv lv-${c.level}">${c.level}</span></div>
    <div class="meter-wrap"><div class="meter"><i></i><i></i><i></i><i></i></div>${c.index!=null?`<span class="marker" style="left:${pct}%;top:-4px"></span>`:''}</div>
    <div class="ticks">${[0,6,12,19,27].map(t=>`<span style="left:${t/27*100}%;${t===0?'transform:none':t===27?'transform:translateX(-100%)':''}">${t}</span>`).join('')}</div>
    <div class="advice">建议：${esc(c.advice)}</div>
    ${c.flags.length?`<ul class="flags">${c.flags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}
  </div>`;
}
function scoreTable(r,editable){
  return `<table class="tbl">${['A','B','C','D','K','N','M','F'].map((k,i)=>{const f=F[k];const v=r[k];
    const txt=v===null||v===undefined?(k==='N'?'未观察（夜间待复查）':'未打分'):f.opts[v][0];
    const sc=v===null||v===undefined?'–':f.w?`${v}×${f.w}=${v*f.w}`:v;
    return `<tr><td>${k.length===1&&f.w?k+' ':''}${esc(f.w?['玻璃量','错觉','几何/曲面','鸟类暴露'][i]:f.name)}</td><td>${esc(txt)}${editable?`<button class="edit-link" data-a="goto" data-v="${STEPS.indexOf(k)}">改</button>`:''}</td><td class="s">${sc}</td></tr>`}).join('')}</table>`;
}
function reviewHTML(d){
  return `<div class="step-h"><h2>确认结果</h2></div>
  <p class="hint" style="margin:6px 0 12px">${esc(d.pointId)} · ${esc(d.building)}${d.facade?' · '+esc(d.facade):''}</p>
  ${resultHTML(d)}
  <div class="box"><h3>各项得分</h3>${scoreTable(d,true)}</div>
  <div class="box">
    <div class="field"><span class="lbl">置信度</span>${chipGroup('confidence',['高','中','低'],d.confidence)}</div>
    <div class="field"><label for="f-photoNo">照片编号（相机/手机里的编号，可选）</label><input class="inp" id="f-photoNo" data-f="photoNo" value="${esc(d.photoNo)}" placeholder="如：IMG_0231–0236"></div>
    <div class="field" style="margin-bottom:0"><label for="f-notes">备注</label><textarea class="inp" id="f-notes" data-f="notes" placeholder="复核时段、发现的撞痕位置、处理建议等">${esc(d.notes)}</textarea></div>
  </div>`;
}
function bindInfo(){
  app.querySelectorAll('input[data-f],textarea[data-f]').forEach(el=>{
    el.oninput=()=>{V.draft[el.dataset.f]=el.value;persistDraft();
      if(STEPS[V.step]==='info'){const nb=app.querySelector('[data-a="next"]');if(nb)nb.disabled=!stepValid('info',V.draft)}};
  });
  app.querySelectorAll('input[type=file]').forEach(el=>el.onchange=()=>{addPhotos([...el.files],el.dataset.kind);el.value=''});
}

/* ---------- Photos ---------- */
function compressImage(file,max=1600,q=0.82){
  return new Promise(res=>{
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;const s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
      c.toBlob(b=>res(b||file),'image/jpeg',q)};
    img.onerror=()=>{URL.revokeObjectURL(url);res(file)};img.src=url;
  });
}
const blobToData=b=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(b)});
async function addPhotos(files,kind){
  const d=V.draft;
  const pending=files.map(file=>({kind,busy:true,url:URL.createObjectURL(file)}));
  d.photos.push(...pending);
  if(STEPS[V.step]==='photos')renderWizard();
  for(let i=0;i<files.length;i++){
    const p=pending[i];
    try{
      if(S.mode==='db'){
        const blob=await compressImage(files[i]);
        p.path=await uploadPhoto(blob);p.url=photoUrl(p.path);
      }else{
        const blob=await compressImage(files[i],1000,0.7);p.data=await blobToData(blob);p.url=p.data;
      }
      p.busy=false;
    }catch(e){
      d.photos.splice(d.photos.indexOf(p),1);
      console.error(e);toast('有照片上传失败：'+(e&&e.message?e.message:'请检查网络后重试'));
    }
    persistDraft();
    if(V.view==='wizard'&&STEPS[V.step]==='photos')renderWizard();
  }
}

/* ---------- Detail ---------- */
function renderDetail(){
  const r=S.records.find(x=>x.id===V.detailId);
  if(!r){if(V.detailId===V.pendingId){app.innerHTML='<div class="empty" style="margin-top:24px"><b>正在保存…</b></div>';return}V.view='list';return renderList()}
  V.pendingId=null;
  const ph=r.photos||[];
  app.innerHTML=`<div class="wz-top"><div class="wz-top-in"><div class="wz-head">
    <button class="linkbtn" data-a="back">← 返回列表</button>
    <div class="row">${S.readOnly?'':`<button class="linkbtn" data-a="edit">编辑</button><button class="linkbtn" style="color:var(--xhigh)" data-a="del">删除</button>`}</div></div></div></div>
  <div class="step">
    <div class="eyebrow">${esc(r.building||'未填建筑')}</div>
    <h2 style="font-size:22px;margin:2px 0 4px">${esc(r.pointId||'未编号')}</h2>
    <p class="hint" style="margin:0 0 12px">${esc([r.facade,r.orientation,fmtDT(r.datetime)].filter(Boolean).join(' · '))}</p>
    ${resultHTML(r)}
    ${ph.length?`<div class="ph-grid">${ph.map((p,i)=>`<div class="ph"><img src="${esc(photoSrc(p))}" alt="${esc(p.kind)}" loading="lazy" data-a="zoomd" data-i="${i}"><span class="tag">${esc(p.kind)}</span></div>`).join('')}</div>`:''}
    <div class="box"><h3>各项得分</h3>${scoreTable(r,false)}</div>
    <div class="box"><h3>记录信息</h3><dl class="kv">
      ${[['天气/光照',[r.weather,r.light].filter(Boolean).join(' / ')],['观察者',r.observer],['观察类型',r.obsType],['置信度',r.confidence],['照片编号',r.photoNo],['备注',r.notes],['最后更新',localDT(r.updatedAt)]]
        .filter(x=>x[1]).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}
    </dl></div>
  </div>`;
  window.scrollTo(0,0);
}

/* ---------- Modals ---------- */
function confirmBox(title,text,okLabel,onOk,danger){
  layer.innerHTML=`<div class="modal" data-a="closemodal"><div class="modal-in" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(text)}</p>
  <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-a="closemodal">取消</button><button class="btn ${danger?'danger':'primary'}" id="okb">${esc(okLabel)}</button></div></div></div>`;
  document.getElementById('okb').onclick=async()=>{layer.innerHTML='';await onOk()};
}
function lightbox(p){layer.innerHTML=`<div class="lightbox" data-a="closelb"><div><img src="${esc(photoSrc(p))}" alt=""><p>${esc(p.kind)} · 点击任意处关闭</p></div></div>`}

/* ---------- CSV ---------- */
const COLS=['点位ID','建筑','立面/特征','朝向','日期时间','天气/光照','观察者','观察类型','A 玻璃量','B 错觉','C 几何/曲面','D 鸟类暴露','完整有效防护(0/1)','夜间N(0–3/空)','碰撞证据(0–2)','飞穿红旗(0–2)','快速筛查指数','风险等级','建议/复核','置信度','照片编号','照片数量','照片类型','照片链接','备注','记录ID','最后更新'];
function csvCell(v){v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function buildCSV(){
  const recs=S.records.slice().sort((a,b)=>(a.building||'').localeCompare(b.building||'','zh')||(a.pointId||'').localeCompare(b.pointId||'','zh',{numeric:true}));
  const rows=recs.map(r=>{const c=compute(r);const ph=r.photos||[];const n=v=>typeof v==='number'?v:'';
    return [r.pointId,r.building,r.facade,r.orientation,fmtDT(r.datetime),[r.weather,r.light].filter(Boolean).join('/'),r.observer,r.obsType,
      n(r.A),n(r.B),n(r.C),n(r.D),n(r.K),n(r.N),n(r.M),n(r.F),c.index??'',c.level,c.advice,r.confidence,r.photoNo,ph.length,
      ph.map(p=>p.kind).join('; '),ph.filter(p=>p.path).map(p=>photoUrl(p.path)).join(' '),r.notes,r.id,localDT(r.updatedAt)].map(csvCell).join(',')});
  return '﻿'+[COLS.join(','),...rows].join('\r\n');
}
function exportCSV(){
  const csv=buildCSV();const d=new Date();const name=`鸟撞点位记录_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.csv`;
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);toast('已导出 '+name);
}

/* ---------- Events ---------- */
let advanceTimer=null;
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-a]');if(!el)return;
  const a=el.dataset.a;
  if(a==='closemodal'){if(e.target===el||el.tagName==='BUTTON')layer.innerHTML='';return}
  if(a==='closelb'){layer.innerHTML='';return}
  if(a==='filter'){V.filter=el.dataset.v;renderList();return}
  if(a==='new'){
    const dr=lsGet(DRAFT_KEY,null);
    V.draft=dr&&(dr.building||dr.pointId||dr.A!==undefined)?Object.assign(newDraft(),dr):newDraft();
    V.step=0;V.view='wizard';renderWizard();
    if(dr&&(dr.building||dr.pointId))toast('已恢复上次未完成的记录');
    return}
  if(a==='open'){V.detailId=el.dataset.id;V.view='detail';renderDetail();return}
  if(a==='back'){V.view='list';renderList();return}
  if(a==='export'){exportCSV();return}
  if(a==='edit'){const r=S.records.find(x=>x.id===V.detailId);V.draft=JSON.parse(JSON.stringify(r));V.draft.photos=V.draft.photos||[];
    ['confidence','photoNo','notes','weather','light','facade','orientation','observer','obsType'].forEach(k=>{if(V.draft[k]==null)V.draft[k]=''});
    V.step=STEPS.length-1;V.view='wizard';renderWizard();return}
  if(a==='del'){const r=S.records.find(x=>x.id===V.detailId);
    confirmBox('删除这条记录？',`${r.pointId||''} · ${r.building||''}，连同 ${(r.photos||[]).length} 张照片会被永久删除。`,'删除',async()=>{
      try{await deleteRecord(r);toast('已删除');V.view='list';render()}catch(err){console.error(err);toast('删除失败：'+(err&&err.message||'请重试'))}},true);return}
  if(a==='zoomd'){const r=S.records.find(x=>x.id===V.detailId);lightbox(r.photos[+el.dataset.i]);return}
  // wizard
  const d=V.draft;if(!d)return;
  if(a==='cancel'){
    if(d.id){V.view='detail';V.draft=null;renderDetail();return}
    confirmBox('退出这条记录？','已填写的内容会保留为草稿，下次点“新建记录”时自动恢复。','退出',()=>{V.view='list';V.draft=null;renderList()});
    return}
  if(a==='chip'){d[el.dataset.f]=d[el.dataset.f]===el.dataset.v&&el.dataset.f!=='confidence'?'':el.dataset.v;persistDraft();
    el.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',d[c.dataset.f]===c.dataset.v));return}
  if(a==='score'){
    const v=el.dataset.v==='null'?null:+el.dataset.v;d[el.dataset.k]=v;persistDraft();
    el.parentElement.querySelectorAll('.opt').forEach(o=>o.classList.toggle('sel',o===el));
    clearTimeout(advanceTimer);
    advanceTimer=setTimeout(()=>{if(V.view!=='wizard')return;
      // after a change made from the summary, jump straight back to it
      V.step=V.backToReview&&firstInvalid(d)===-1?STEPS.length-1:Math.min(STEPS.indexOf(el.dataset.k)+1,STEPS.length-1);
      renderWizard()},260);
    return}
  if(a==='goto'){const t=+el.dataset.v;if(STEPS[V.step]==='review')V.backToReview=true;if(t<=V.step||firstInvalid(d)===-1||t<=firstInvalid(d)){V.step=t;renderWizard()}else toast('请先完成：'+STEP_NAMES[STEPS[firstInvalid(d)]]);return}
  if(a==='prev'){V.step=Math.max(0,V.step-1);renderWizard();return}
  if(a==='next'){if(STEPS[V.step]==='info')lsSet('bg-observer',d.observer||'');V.step=Math.min(STEPS.length-1,V.step+1);renderWizard();return}
  if(a==='rmphoto'){d.photos.splice(+el.dataset.i,1);persistDraft();renderWizard();return}
  if(a==='zoom'){lightbox(d.photos[+el.dataset.i]);return}
  if(a==='save'){
    const inv=firstInvalid(d);if(inv!==-1){V.step=inv;renderWizard();toast('还没完成：'+STEP_NAMES[STEPS[inv]]);return}
    el.disabled=true;el.textContent='保存中…';
    try{const id=await saveRecord(d);if(!d.id)lsDel(DRAFT_KEY);
      toast(d.id?'已保存修改':'记录已保存');V.draft=null;V.detailId=id;V.pendingId=id;V.view='detail';render();
    }catch(err){el.disabled=false;el.textContent='重试保存';
      console.error(err);toast(err&&err.code==='local_full'?'浏览器存储已满，请先导出并删除旧记录':'保存失败：'+(err&&err.message?err.message:'请检查网络后重试'))}
    return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')layer.innerHTML=''});

render();
initStore();

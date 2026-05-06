
function toNormalizedIdentityKey(name, team, pos){
  const n=(typeof name==="string"?name.trim().toLowerCase():"");
  const t=(typeof team==="string"?team.trim().toUpperCase():"");
  const p=(typeof pos==="string"?pos.trim().toUpperCase():"");
  return {full:n+"|"+t+"|"+p,nameTeam:n+"|"+t,namePos:n+"|"+p,nameOnly:n};
}
function extractAdpRecords(payload){
  if(Array.isArray(payload)) return payload;
  if(payload && typeof payload==="object"){
    if(Array.isArray(payload.records)) return payload.records;
    if(Array.isArray(payload.players)) return payload.players;
    if(Array.isArray(payload.data)) return payload.data;
  }
  return [];
}
function pickFirstDefined(source, keys){
  if(!source || typeof source!=="object") return undefined;
  for(const key of keys){
    if(Object.prototype.hasOwnProperty.call(source,key) && source[key]!==undefined) return source[key];
  }
  return undefined;
}
function fallbackNormalizeAdpData(adpLike){
  const input=(adpLike && typeof adpLike==="object") ? adpLike : {};
  const raw=pickFirstDefined(input,["overall","adp","avgPick","averageDraftPosition"]);
  const overall=Number(raw);
  return {overall:Number.isFinite(overall)?overall:null};
}
function fallbackNormalizePlayerIdentity(playerLike){
  const input=(playerLike && typeof playerLike==="object") ? playerLike : {};
  const rawId=pickFirstDefined(input,["id","playerId","player_id"]);
  const idNum=Number(rawId);
  const nameVal=pickFirstDefined(input,["name","fullName","playerName","player_name"]);
  const teamVal=pickFirstDefined(input,["team","teamAbbr","team_abbr","teamCode"]);
  const posVal=pickFirstDefined(input,["pos","position","positionCode"]);
  return {
    id:Number.isFinite(idNum)?Math.trunc(idNum):null,
    name:typeof nameVal==="string"?nameVal.trim():"",
    team:typeof teamVal==="string"?teamVal.trim().toUpperCase():"",
    pos:typeof posVal==="string"?posVal.trim().toUpperCase():""
  };
}
function applyAdpOverlay(players, externalPayload){
  if(!Array.isArray(players) || !players.length){
    return {attempted:0,matched:0,updated:0,unmatched:0,invalidAdp:0};
  }

  const records=extractAdpRecords(externalPayload);
  if(!records.length){
    return {attempted:0,matched:0,updated:0,unmatched:0,invalidAdp:0};
  }

  const byId=new Map();
  const byFull=new Map();
  const byNameTeam=new Map();
  const byNamePos=new Map();
  const byNameOnly=new Map();

  players.forEach(function(player){
    if(player && typeof player.id==="number") byId.set(player.id, player);
    const keys=toNormalizedIdentityKey(player && player.name, player && player.team, player && player.pos);
    if(keys.full!=="||") byFull.set(keys.full, player);
    if(keys.nameTeam!=="|") byNameTeam.set(keys.nameTeam, player);
    if(keys.namePos!=="|") byNamePos.set(keys.namePos, player);
    if(keys.nameOnly) byNameOnly.set(keys.nameOnly, player);
  });

  const adapters=(typeof DataAdapters!=="undefined" && DataAdapters)?DataAdapters:null;
  const normalizeAdp=(adapters && typeof adapters.normalizeAdpData==="function") ? adapters.normalizeAdpData : fallbackNormalizeAdpData;
  const normalizeIdentity=(adapters && typeof adapters.normalizePlayerIdentity==="function") ? adapters.normalizePlayerIdentity : fallbackNormalizePlayerIdentity;
  const counts={attempted:records.length,matched:0,updated:0,unmatched:0,invalidAdp:0};

  records.forEach(function(record){
    const normalizedAdp=normalizeAdp(record && record.adpData ? record.adpData : record);
    const adpValue=normalizedAdp && Number.isFinite(normalizedAdp.overall) ? normalizedAdp.overall : null;
    if(!(Number.isFinite(adpValue) && adpValue>0)){
      counts.invalidAdp+=1;
      return;
    }

    const identity=normalizeIdentity(record);

    let match=null;
    if(Number.isFinite(identity.id) && byId.has(identity.id)){
      match=byId.get(identity.id);
    } else {
      const keys=toNormalizedIdentityKey(identity.name, identity.team, identity.pos);
      match=byFull.get(keys.full) || byNameTeam.get(keys.nameTeam) || byNamePos.get(keys.namePos) || byNameOnly.get(keys.nameOnly) || null;
    }

    if(!match){
      counts.unmatched+=1;
      return;
    }

    counts.matched+=1;
    if(match.adp!==adpValue){
      match.adp=adpValue;
      counts.updated+=1;
    }
  });

  return counts;
}
const ADP_OVERLAY_SUMMARY=applyAdpOverlay(PLAYERS, (typeof window!=="undefined" ? window.EXTERNAL_ADP_PAYLOAD : null));
if(ADP_OVERLAY_SUMMARY.attempted>0){
  console.info("[ADP overlay]", ADP_OVERLAY_SUMMARY);
}

function readBlurbsNewsPayload(){
  if(typeof DataProviders!=="undefined" && DataProviders && typeof DataProviders.blurbsNews==="function"){
    const providedPayload=DataProviders.blurbsNews();
    if(providedPayload && typeof providedPayload==="object") return providedPayload;
  }
  if(typeof window!=="undefined" && Object.prototype.hasOwnProperty.call(window,"BLURBS_NEWS_PAYLOAD")){
    const fallbackPayload=window.BLURBS_NEWS_PAYLOAD;
    if(fallbackPayload && typeof fallbackPayload==="object") return fallbackPayload;
  }
  return null;
}
function applyBlurbsNewsOverlay(players, payload){
  if(!Array.isArray(players) || !players.length || !payload || typeof payload!=="object") return {attempted:0,matched:0,updated:0};
  const byId=new Map();
  const byName=new Map();
  players.forEach(function(player){
    if(player && typeof player.id==="number") byId.set(player.id, player);
    if(player && typeof player.name==="string") byName.set(player.name.trim().toLowerCase(), player);
  });
  const records=Array.isArray(payload.records)?payload.records:Array.isArray(payload.players)?payload.players:Array.isArray(payload.data)?payload.data:[];
  const fields=["blurb","blurbs","news","comment","comments"];
  const counts={attempted:records.length,matched:0,updated:0};
  records.forEach(function(record){
    if(!record || typeof record!=="object") return;
    const idNum=Number(record.id ?? record.playerId ?? record.player_id);
    const nameKey=typeof (record.name ?? record.playerName)==="string" ? (record.name ?? record.playerName).trim().toLowerCase() : "";
    const player=Number.isFinite(idNum)?byId.get(Math.trunc(idNum)):(nameKey?byName.get(nameKey):null);
    if(!player) return;
    counts.matched+=1;
    let didUpdate=false;
    fields.forEach(function(field){
      if(!Object.prototype.hasOwnProperty.call(record,field)) return;
      const incoming=record[field];
      if(typeof incoming!=="string") return;
      if(player[field]!==incoming){
        player[field]=incoming;
        didUpdate=true;
      }
    });
    if(didUpdate) counts.updated+=1;
  });
  return counts;
}
const BLURBS_NEWS_OVERLAY_SUMMARY=applyBlurbsNewsOverlay(PLAYERS, readBlurbsNewsPayload());
if(BLURBS_NEWS_OVERLAY_SUMMARY.attempted>0){
  console.info("[Blurbs/news overlay]", BLURBS_NEWS_OVERLAY_SUMMARY);
}

function readHistoricalStatsPayload(){
  if(typeof DataProviders!=="undefined" && DataProviders && typeof DataProviders.historicalStats==="function"){
    const providedPayload=DataProviders.historicalStats();
    if(providedPayload && typeof providedPayload==="object") return providedPayload;
  }
  if(typeof window!=="undefined" && Object.prototype.hasOwnProperty.call(window,"HISTORICAL_STATS_PAYLOAD")){
    const fallbackPayload=window.HISTORICAL_STATS_PAYLOAD;
    if(fallbackPayload && typeof fallbackPayload==="object") return fallbackPayload;
  }
  return null;
}
function applyHistoricalStatsOverlay(players, payload){
  if(!Array.isArray(players) || !players.length || !payload || typeof payload!=="object") return {attempted:0,matched:0,updated:0};
  const byId=new Map();
  players.forEach(function(player){ if(player && typeof player.id==="number") byId.set(player.id, player); });
  const byName=new Map();
  players.forEach(function(player){ if(player && typeof player.name==="string") byName.set(player.name.trim().toLowerCase(), player); });

  const records=Array.isArray(payload.records)?payload.records:Array.isArray(payload.players)?payload.players:Array.isArray(payload.data)?payload.data:[];
  const counts={attempted:records.length,matched:0,updated:0};
  records.forEach(function(record){
    if(!record || typeof record!=="object") return;
    const idNum=Number(record.id ?? record.playerId ?? record.player_id);
    const nameKey=typeof (record.name ?? record.playerName)==="string" ? (record.name ?? record.playerName).trim().toLowerCase() : "";
    const player=Number.isFinite(idNum)?byId.get(Math.trunc(idNum)):(nameKey?byName.get(nameKey):null);
    if(!player || !record.stats || typeof record.stats!=="object") return;
    counts.matched+=1;
    Object.keys(record.stats).forEach(function(season){
      const seasonStats=record.stats[season];
      if(!seasonStats || typeof seasonStats!=="object") return;
      if(!player.stats || typeof player.stats!=="object") player.stats={};
      const existingSeason=(player.stats[season] && typeof player.stats[season]==="object") ? player.stats[season] : {};
      let seasonUpdated=false;
      Object.keys(seasonStats).forEach(function(field){
        if(seasonStats[field]===undefined) return;
        if(existingSeason[field]!==seasonStats[field]){
          existingSeason[field]=seasonStats[field];
          seasonUpdated=true;
        }
      });
      if(seasonUpdated){
        player.stats[season]=existingSeason;
        counts.updated+=1;
      }
    });
  });
  return counts;
}
const HISTORICAL_STATS_OVERLAY_SUMMARY=applyHistoricalStatsOverlay(PLAYERS, readHistoricalStatsPayload());
if(HISTORICAL_STATS_OVERLAY_SUMMARY.attempted>0){
  console.info("[Historical stats overlay]", HISTORICAL_STATS_OVERLAY_SUMMARY);
}

const state = {format:"half",teams:12,drafted:[],watch:[],compare:[],compareDetailPlayerId:null,rankingDetailPlayerId:null,search:"",pos:"ALL",tab:"setup",rankSort:"rank",rankDir:"asc",favoriteTeam:"",slots:{QB:1,RB:2,WR:2,TE:1,K:1,DST:1,FLEX:1},flexMode:["RB","WR","TE"],compareMetrics:new Set(["position","team","age","exp","bye","elite","projfp","projppg","avg3","gp2025","avg2025","median2025","low2025","high2025","posrank","adp","sleeper","bust","injury"])};

function explainContent(type){
  const content = {
    tier:{title:'Tier Explanation', body:`<p>Tiers group players by overall value and confidence.</p><div class="explain-grid"><div class="explain-card"><strong>Tier 1</strong>Elite fantasy assets.</div><div class="explain-card"><strong>Tier 2</strong>Strong starters with upside.</div><div class="explain-card"><strong>Tier 3</strong>Solid contributors and mid-tier starters.</div><div class="explain-card"><strong>Tier 4+</strong>Depth, stash, or situational plays.</div></div>`},
    projection:{title:'Projection Explanation', body:`<p>Projection blends role, usage, and format into expected fantasy points and points per game.</p>`},
    sleeper:{title:'Sleeper Explanation', body:`<p>Sleeper score highlights players who may outperform current market cost.</p>`},
    bust:{title:'Bust Explanation', body:`<p>Bust score reflects downside risk relative to draft price.</p>`},
    injury:{title:'Injury Explanation', body:`<p>Injury risk summarizes durability concern and missed-time profile.</p>`}
  };
  return content[type] || content.tier;
}
function openExplainSheet(type){
  const c = explainContent(type);
  document.getElementById('explainTitle').innerHTML = c.title;
  document.getElementById('explainBody').innerHTML = c.body;
  const overlay = document.getElementById('explainOverlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}
function closeExplainSheet(){
  const overlay = document.getElementById('explainOverlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
}
function rankingDetailHtml(p){
  return '<div class="mini compare-detail-panel">'
    + '<button class="secondary compare-detail-back" id="backToRankingsBtn">Back to Rankings</button>'
    + '<div style="font-weight:800;font-size:20px;margin-bottom:6px">'+p.name+'</div>'
    + '<div class="muted" style="margin-bottom:10px">'+p.team+' • '+p.pos+' • <span class="tap-explain" data-explain="tier">Tier '+p.tier+'</span> • '+(p.pos==="DST"?'Team Defense':('Age '+p.age+' • '+yearsLabel(p)))+' • Bye '+p.bye+'</div>'
    + '<div class="callout narrative"><strong>Narrative:</strong> '+playerNarrative(p)+'</div>'
    + '<div class="detail-table-wrap">' + statsTable(p) + '</div>'
    + '<div class="callout sleeper"><strong><span class="tap-explain" data-explain="sleeper">Sleeper score</span>:</strong> '+sleeperScore(p).toFixed(0)+'/100</div>'
    + '<div class="callout bust"><strong><span class="tap-explain" data-explain="bust">Bust score</span>:</strong> '+bustScore(p).toFixed(0)+'/100</div>'
    + '<div class="callout risk"><strong><span class="tap-explain" data-explain="injury">Injury risk</span>:</strong> '+injuryCategory(p.injuryRisk)+' ('+p.injuryRisk+'/100)</div>'
    + '</div>';
}
function openRankingPlayerDetail(id){ state.rankingDetailPlayerId=id; renderRankings(); }


function applyTeamTheme(team){
  const root=document.documentElement;
  if(!team || !TEAM_COLORS[team]){ root.style.setProperty('--team-primary','#67a8ff'); root.style.setProperty('--team-secondary','#7ff0cb'); applyButtonContrast(); return; }
  root.style.setProperty('--team-primary',TEAM_COLORS[team].primary);
  root.style.setProperty('--team-secondary',TEAM_COLORS[team].secondary);
  applyButtonContrast();
}
function getPlayer(id){ return PLAYERS.find(p=>p.id===id); }
function yearsLabel(p){ if(p.pos==="DST") return "Team unit"; if(p.rookie) return "Rookie"; return p.yearsInLeague+" yrs"; }
function projectedFantasyPoints(p){ return p.proj[state.format]; }
function projectedPPG(p){ return projectedFantasyPoints(p)/17; }
function avg3ppg(p){ return (p.stats["2023"].avg+p.stats["2024"].avg+p.stats["2025"].avg)/3; }
function injuryCategory(score){ return score<30?"Low":score<60?"Medium":"High"; }
function adpRoundPick(adp){ const round=Math.max(1,Math.ceil(adp/state.teams)); const pick=Math.max(1,Math.round(adp-((round-1)*state.teams))); return "R"+round+" P"+pick; }
function scorePlayer(p){
  const projNorm=Math.max(0,Math.min(100,((projectedFantasyPoints(p)-3)/(24-3))*100));
  const riskPenalty=p.injuryRisk/8;
  const formatBonus=(state.format==="ppr"&&(p.pos==="WR"||p.pos==="TE"))?4:0;
  const stdBonus=(state.format==="standard"&&p.pos==="RB")?4:0;
  const favBonus=(state.favoriteTeam && p.team===state.favoriteTeam)?1.2:0;
  const flexBonus=(state.slots.FLEX>=2 && state.flexMode.includes(p.pos))?3:0;
  const scarcity=p.pos==="QB"?3:p.pos==="RB"?8.5:p.pos==="WR"?8:p.pos==="TE"?5.5:p.pos==="K"?2.5:3.5;
  return projNorm*0.42+p.consistency*0.14+p.upside*0.18+p.playoff*0.10+(101-Math.min(100,p.adp))*0.05+scarcity+formatBonus+stdBonus+favBonus+flexBonus-riskPenalty;
}
function currentRankedPool(){
  let pool=PLAYERS.filter(p=>!state.drafted.includes(p.id));
  if(state.pos!=="ALL") pool=pool.filter(p=>p.pos===state.pos);
  const q=state.search.trim().toLowerCase();
  if(q) pool=pool.filter(p=>p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q));
  return pool.sort((a,b)=>scorePlayer(b)-scorePlayer(a));
}
function posRankMap(){ const sorted=[...PLAYERS].sort((a,b)=>scorePlayer(b)-scorePlayer(a)); const counts={QB:0,RB:0,WR:0,TE:0,K:0,DST:0}, map={}; sorted.forEach(p=>{counts[p.pos]+=1; map[p.id]=counts[p.pos];}); return map; }
function draftedPlayers(){ return PLAYERS.filter(p=>state.drafted.includes(p.id)); }
function biggestNeed(){
  const counts={QB:0,RB:0,WR:0,TE:0,K:0,DST:0}; draftedPlayers().forEach(p=>counts[p.pos]++);
  for(const key of ["QB","RB","WR","TE","K","DST"]){ if(counts[key] < state.slots[key]) return key; }
  for(const allowed of state.flexMode){ if(counts[allowed] < state.slots[allowed]+state.slots.FLEX) return allowed; }
  return "WR";
}
function rosterTemplate(){
  const slots=[];
  for(let i=1;i<=state.slots.QB;i++) slots.push({label:'QB'+i, positions:['QB']});
  for(let i=1;i<=state.slots.RB;i++) slots.push({label:'RB'+i, positions:['RB']});
  for(let i=1;i<=state.slots.WR;i++) slots.push({label:'WR'+i, positions:['WR']});
  for(let i=1;i<=state.slots.TE;i++) slots.push({label:'TE'+i, positions:['TE']});
  for(let i=1;i<=state.slots.FLEX;i++) slots.push({label:'FLEX'+i, positions:[...state.flexMode]});
  for(let i=1;i<=state.slots.K;i++) slots.push({label:'K'+i, positions:['K']});
  for(let i=1;i<=state.slots.DST;i++) slots.push({label:'DST'+i, positions:['DST']});
  return slots;
}
function assignRoster(){
  const drafted=[...draftedPlayers()].sort((a,b)=>scorePlayer(b)-scorePlayer(a)); const used=new Set();
  return rosterTemplate().map(slot=>{ const player=drafted.find(p=>!used.has(p.id)&&slot.positions.includes(p.pos)); if(player) used.add(player.id); return {slot,player:player||null}; });
}
function sleeperScore(p){ const rank=currentRankedPool().findIndex(x=>x.id===p.id)+1; let score=35+Math.max(0,(p.adp-rank)*3)+Math.max(0,p.upside-80)*0.5-Math.max(0,p.injuryRisk-50)*0.25; if(p.adp<=12) score-=25; return Math.max(0,Math.min(100,score)); }
function bustScore(p){ let score=15+Math.max(0,30-p.adp)*1.2+Math.max(0,p.injuryRisk-45)*0.7+Math.max(0,65-p.consistency)*0.6+Math.max(0,(p.age||0)-29)*0.8; return Math.max(0,Math.min(100,score)); }
function setPos(pos){ state.pos=pos; renderDraft(); }
function draftPlayer(id){ if(!state.drafted.includes(id)) state.drafted.push(id); renderAll(); }
function removePlayer(id){ state.drafted=state.drafted.filter(x=>x!==id); renderAll(); }
function toggleWatch(id){ if(state.watch.includes(id)) state.watch=state.watch.filter(x=>x!==id); else state.watch.push(id); renderAll(); }
function toggleCompare(id){
  if(state.compare.includes(id)) {
    state.compare = state.compare.filter(x=>x!==id);
  } else {
    if(state.compare.length >= 5) state.compare.shift();
    state.compare.push(id);
  }
  if(state.compare.length === 5){
    state.tab = "compare";
    syncTabs();
  }
  state.compareDetailPlayerId = null;
  renderAll();
}
function toggleDetail(id){ const el=document.getElementById("detail-"+id); if(el) el.classList.toggle("open"); }
function syncTabs(){ document.querySelectorAll(".tab").forEach(el=>el.classList.toggle("active",el.dataset.tab===state.tab)); document.querySelectorAll(".tabs-content>div").forEach(el=>el.classList.remove("active")); document.getElementById("tab-"+state.tab).classList.add("active"); }
function bar(label,val){ const pct=Math.max(0,Math.min(100,Math.round(val))); return '<div class="barbox"><div class="barlabel"><span>'+label+'</span><span>'+pct+'</span></div><div class="track"><div class="fill" style="width:'+pct+'%"></div></div></div>'; }


// FIX: always populate favorite team dropdown reliably
function ensureFavoriteTeams(){
  const teams=[...new Set(PLAYERS.map(p=>p.team))].sort();
  const el=document.getElementById("favoriteTeam");
  if(!el) return;
  const current = state.favoriteTeam || "";
  el.innerHTML='<option value="">Favorite team</option>'+teams.map(t=>'<option value="'+t+'" '+(current===t?'selected':'')+'>'+t+'</option>').join('');
}

function renderFavoriteTeams(){
  const teams=[...new Set(PLAYERS.map(p=>p.team))].sort();
  const el=document.getElementById("favoriteTeam");
  el.innerHTML='<option value="">Favorite team</option>'+teams.map(t=>'<option value="'+t+'" '+(state.favoriteTeam===t?'selected':'')+'>'+t+'</option>').join('');
}
function renderSavedProfiles(){
  const profiles = JSON.parse(localStorage.getItem('fantasy_league_profiles') || '{}');
  const keys = Object.keys(profiles).sort();
  const sel = document.getElementById('savedProfiles');
  sel.innerHTML = '<option value="">Saved profiles</option>' + keys.map(k => '<option value="'+k+'">'+k+'</option>').join('');
}
function syncControlsFromState(){
  document.getElementById('format').value = state.format;
  document.getElementById('teams').value = String(state.teams);
  document.getElementById('favoriteTeam').value = state.favoriteTeam;
  document.getElementById('slotQB').value = String(state.slots.QB);
  document.getElementById('slotRB').value = String(state.slots.RB);
  document.getElementById('slotWR').value = String(state.slots.WR);
  document.getElementById('slotTE').value = String(state.slots.TE);
  document.getElementById('slotK').value = String(state.slots.K);
  document.getElementById('slotDST').value = String(state.slots.DST);
  document.getElementById('slotFLEX').value = String(state.slots.FLEX);
  document.getElementById('flexMode').value = state.flexMode.join(',');
}
function renderMetrics(){
  document.getElementById("mPool").textContent=String(PLAYERS.length);
  document.getElementById("mDrafted").textContent=String(state.drafted.length);
  document.getElementById("mNeed").textContent=biggestNeed();
  document.getElementById("mFormat").textContent=state.format==="half"?"Half-PPR":state.format.toUpperCase();
  document.getElementById("mTeams").textContent=String(state.teams);
  document.getElementById("mWatch").textContent=String(state.watch.length);
}
function renderSetupSummary(){
  document.getElementById("setupSummary").innerHTML =
    'Scoring: <strong>'+ (state.format==="half"?"Half-PPR":state.format.toUpperCase()) +'</strong><br>' +
    'Teams: <strong>'+ state.teams +'</strong><br>' +
    'Roster: <strong>'+ ['QB '+state.slots.QB,'RB '+state.slots.RB,'WR '+state.slots.WR,'TE '+state.slots.TE,'K '+state.slots.K,'DST '+state.slots.DST,'FLEX '+state.slots.FLEX].join(' • ') +'</strong><br>' +
    'Flex types: <strong>'+ state.flexMode.join(' / ') +'</strong>';
}
function renderSetup(){
  ensureFavoriteTeams();
  renderFavoriteTeams();
  renderSavedProfiles();
  syncControlsFromState();
  renderSetupSummary();
}
function renderChips(){
  const opts=["ALL","QB","RB","WR","TE","K","DST"];
  document.getElementById("posChips").innerHTML=opts.map(pos=>'<div class="chip '+(state.pos===pos?'active':'')+'" data-pos="'+pos+'">'+pos+'</div>').join('');
  document.querySelectorAll('#posChips .chip').forEach(el=>el.addEventListener('click',()=>setPos(el.dataset.pos)));
}
function renderRankings(){
  const host = document.getElementById('rankingDetailHost');
  if(host){
    if(state.rankingDetailPlayerId){
      const p = getPlayer(state.rankingDetailPlayerId);
      host.innerHTML = p ? rankingDetailHtml(p) : '';
      const back = document.getElementById('backToRankingsBtn');
      if(back){
        back.onclick = function(e){
          e.preventDefault();
          state.rankingDetailPlayerId = null;
          renderRankings();
        };
      }
    } else {
      host.innerHTML = '';
    }
  }

  let rows=currentRankedPool().map((p,idx)=>({id:p.id,rank:idx+1,name:p.name,pos:p.pos,team:p.team,bye:p.bye,exp:yearsLabel(p),adp:p.adp,elite:scorePlayer(p),projfp:projectedFantasyPoints(p),projppg:projectedPPG(p),avg2025:p.stats["2025"].avg,avg3:avg3ppg(p),sleeper:sleeperScore(p),bust:bustScore(p)}));
  const key=state.rankSort;
  rows.sort((a,b)=>{ let av=a[key], bv=b[key]; if(typeof av==="string"){ av=av.toLowerCase(); bv=bv.toLowerCase(); if(av<bv) return state.rankDir==="asc"?-1:1; if(av>bv) return state.rankDir==="asc"?1:-1; return 0; } return state.rankDir==="asc"?av-bv:bv-av; });
  const headers=[["rank","#"],["name","Player"],["pos","Pos"],["team","Team"],["bye","Bye"],["exp","Exp"],["adp","ADP"],["elite","Elite"],["projfp","Proj FP"],["projppg","Proj PPG"],["avg2025","2025 Avg"],["avg3","Avg 23-25"],["sleeper","Sleeper"],["bust","Bust"]];
  document.getElementById("rankTable").innerHTML='<thead><tr>'+headers.map(h=>'<th data-sort="'+h[0]+'">'+h[1]+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.rank+'</td><td><button type="button" class="compare-player-link" data-rank-open="'+r.id+'">'+r.name+'</button></td><td>'+r.pos+'</td><td>'+r.team+'</td><td>'+r.bye+'</td><td>'+r.exp+'</td><td>'+r.adp.toFixed(1)+'</td><td>'+r.elite.toFixed(1)+'</td><td>'+r.projfp.toFixed(1)+'</td><td>'+r.projppg.toFixed(1)+'</td><td>'+r.avg2025.toFixed(1)+'</td><td>'+r.avg3.toFixed(1)+'</td><td>'+r.sleeper.toFixed(0)+'</td><td>'+r.bust.toFixed(0)+'</td></tr>').join('')+'</tbody>';
  document.querySelectorAll('#rankTable [data-sort]').forEach(el=>el.addEventListener('click',()=>{ const k=el.dataset.sort; if(state.rankSort===k){ state.rankDir=state.rankDir==="asc"?"desc":"asc"; } else { state.rankSort=k; state.rankDir=(k==="name"||k==="pos"||k==="team"||k==="exp")?"asc":"desc"; } renderRankings(); }));
  document.querySelectorAll('#rankTable [data-rank-open]').forEach(btn=>btn.addEventListener('click',()=>{ state.rankingDetailPlayerId = Number(btn.dataset.rankOpen); renderRankings(); }));
}

function totalsRow(p){
  const a=p.stats["2023"], b=p.stats["2024"], c=p.stats["2025"];
  return {gp:a.gp+b.gp+c.gp, avg:(a.avg+b.avg+c.avg)/3, median:(a.median+b.median+c.median)/3, low:Math.min(a.low,b.low,c.low), high:Math.max(a.high,b.high,c.high)};
}
function playerNarrative(p){
  const totalMissed=(17-p.stats["2023"].gp)+(17-p.stats["2024"].gp)+(17-p.stats["2025"].gp);
  return p.name+' • Bye week '+p.bye+' • '+yearsLabel(p)+'. Across 2023-2025, the profile shows '+totalMissed+' total games missed, which feeds the injury-risk score. Projection is shown for the upcoming season and scoring changes with the selected format.';
}
function statsTable(p){
  const t=totalsRow(p), yrs=["2023","2024","2025"];
  if(p.pos==="QB"){ return '<table class="table"><thead><tr><th>Year</th><th>GP</th><th>Avg</th><th>Median</th><th>Low</th><th>High</th><th>Pass Yds</th><th>Pass TD</th><th>INT</th></tr></thead><tbody>'+yrs.map(y=>'<tr><td>'+y+'</td><td>'+p.stats[y].gp+'</td><td>'+p.stats[y].avg.toFixed(1)+'</td><td>'+p.stats[y].median.toFixed(1)+'</td><td>'+p.stats[y].low.toFixed(1)+'</td><td>'+p.stats[y].high.toFixed(1)+'</td><td>'+(3900-(p.id%25)*60+(y==="2024"?120:y==="2025"?180:0))+'</td><td>'+(28-(p.id%8)+(y==="2024"?1:y==="2025"?2:0))+'</td><td>'+(8+(p.id%5))+'</td></tr>').join('')+'<tr><td><strong>Total 23-25</strong></td><td>'+t.gp+'</td><td>'+t.avg.toFixed(1)+'</td><td>'+t.median.toFixed(1)+'</td><td>'+t.low.toFixed(1)+'</td><td>'+t.high.toFixed(1)+'</td><td colspan="3"></td></tr><tr><td><strong><span class="tap-explain" data-explain="projection">Proj</span></strong></td><td>17</td><td>'+projectedPPG(p).toFixed(1)+'</td><td>-</td><td>-</td><td>-</td><td>'+(4150-(p.id%25)*55)+'</td><td>'+(30-(p.id%8))+'</td><td>'+(8+(p.id%5))+'</td></tr></tbody></table>'; }
  if(p.pos==="RB"){ return '<table class="table"><thead><tr><th>Year</th><th>GP</th><th>Avg</th><th>Median</th><th>Low</th><th>High</th><th>Rush Att</th><th>Rush Yds</th><th>YPC</th><th>Rush TD</th><th>Rec</th><th>Rec Yds</th><th>YPCt</th><th>Targets</th><th>Rec TD</th></tr></thead><tbody>'+yrs.map(y=>{ const rushAtt=(210-(p.id%25)*3+(y==="2024"?10:y==="2025"?15:0)); const rushYds=(980-(p.id%25)*14+(y==="2024"?70:y==="2025"?110:0)); const rushTd=(6+(p.id%6)+(y==="2024"?1:y==="2025"?2:0)); const rec=(42-(p.id%9)+(y==="2024"?3:y==="2025"?5:0)); const recYds=(290-(p.id%20)*7+(y==="2024"?25:y==="2025"?45:0)); const targets=(52-(p.id%10)+(y==="2024"?4:y==="2025"?6:0)); const recTd=(2+(p.id%4)+(y==="2024"?1:y==="2025"?1:0)); const ypc=(rushYds/Math.max(1,rushAtt)).toFixed(1); const ypr=(recYds/Math.max(1,rec)).toFixed(1); return '<tr><td>'+y+'</td><td>'+p.stats[y].gp+'</td><td>'+p.stats[y].avg.toFixed(1)+'</td><td>'+p.stats[y].median.toFixed(1)+'</td><td>'+p.stats[y].low.toFixed(1)+'</td><td>'+p.stats[y].high.toFixed(1)+'</td><td>'+rushAtt+'</td><td>'+rushYds+'</td><td>'+ypc+'</td><td>'+rushTd+'</td><td>'+rec+'</td><td>'+recYds+'</td><td>'+ypr+'</td><td>'+targets+'</td><td>'+recTd+'</td></tr>'; }).join('')+'<tr><td><strong>Total 23-25</strong></td><td>'+t.gp+'</td><td>'+t.avg.toFixed(1)+'</td><td>'+t.median.toFixed(1)+'</td><td>'+t.low.toFixed(1)+'</td><td>'+t.high.toFixed(1)+'</td><td colspan="9"></td></tr><tr><td><strong><span class="tap-explain" data-explain="projection">Proj</span></strong></td><td>17</td><td>'+projectedPPG(p).toFixed(1)+'</td><td>-</td><td>-</td><td>-</td><td>'+(240-(p.id%25)*3)+'</td><td>'+(1180-(p.id%25)*12)+'</td><td>'+((1180-(p.id%25)*12)/Math.max(1,(240-(p.id%25)*3))).toFixed(1)+'</td><td>'+(8+(p.id%6))+'</td><td>'+(48-(p.id%9))+'</td><td>'+(340-(p.id%20)*6)+'</td><td>'+((340-(p.id%20)*6)/Math.max(1,(48-(p.id%9)))).toFixed(1)+'</td><td>'+(58-(p.id%10))+'</td><td>'+(3+(p.id%4))+'</td></tr></tbody></table>'; }
  if(p.pos==="WR" || p.pos==="TE"){ return '<table class="table"><thead><tr><th>Year</th><th>GP</th><th>Avg</th><th>Median</th><th>Low</th><th>High</th><th>Targets</th><th>Rec</th><th>Rec Yds</th><th>Rec TD</th></tr></thead><tbody>'+yrs.map(y=>{ const targets=(130-(p.id%25)*3+(y==="2024"?8:y==="2025"?14:0)); const rec=(82-(p.id%20)*2+(y==="2024"?3:y==="2025"?6:0)); const recYds=(1080-(p.id%25)*18+(y==="2024"?60:y==="2025"?110:0)); const recTd=(6+(p.id%5)+(y==="2024"?1:y==="2025"?2:0)); return '<tr><td>'+y+'</td><td>'+p.stats[y].gp+'</td><td>'+p.stats[y].avg.toFixed(1)+'</td><td>'+p.stats[y].median.toFixed(1)+'</td><td>'+p.stats[y].low.toFixed(1)+'</td><td>'+p.stats[y].high.toFixed(1)+'</td><td>'+targets+'</td><td>'+rec+'</td><td>'+recYds+'</td><td>'+recTd+'</td></tr>'; }).join('')+'<tr><td><strong>Total 23-25</strong></td><td>'+t.gp+'</td><td>'+t.avg.toFixed(1)+'</td><td>'+t.median.toFixed(1)+'</td><td>'+t.low.toFixed(1)+'</td><td>'+t.high.toFixed(1)+'</td><td colspan="4"></td></tr><tr><td><strong><span class="tap-explain" data-explain="projection">Proj</span></strong></td><td>17</td><td>'+projectedPPG(p).toFixed(1)+'</td><td>-</td><td>-</td><td>-</td><td>'+(138-(p.id%25)*3)+'</td><td>'+(88-(p.id%20)*2)+'</td><td>'+(1180-(p.id%25)*16)+'</td><td>'+(7+(p.id%5))+'</td></tr></tbody></table>'; }
  if(p.pos==="K"){ return '<table class="table"><thead><tr><th>Year</th><th>GP</th><th>Avg</th><th>Median</th><th>Low</th><th>High</th><th>FGM</th><th>50+</th><th>XPM</th></tr></thead><tbody>'+yrs.map(y=>'<tr><td>'+y+'</td><td>'+p.stats[y].gp+'</td><td>'+p.stats[y].avg.toFixed(1)+'</td><td>'+p.stats[y].median.toFixed(1)+'</td><td>'+p.stats[y].low.toFixed(1)+'</td><td>'+p.stats[y].high.toFixed(1)+'</td><td>'+(29-(p.id%8)+(y==="2024"?2:y==="2025"?3:0))+'</td><td>'+(4+(p.id%4))+'</td><td>'+(33-(p.id%7)+(y==="2024"?2:y==="2025"?4:0))+'</td></tr>').join('')+'<tr><td><strong>Total 23-25</strong></td><td>'+t.gp+'</td><td>'+t.avg.toFixed(1)+'</td><td>'+t.median.toFixed(1)+'</td><td>'+t.low.toFixed(1)+'</td><td>'+t.high.toFixed(1)+'</td><td colspan="3"></td></tr><tr><td><strong><span class="tap-explain" data-explain="projection">Proj</span></strong></td><td>17</td><td>'+projectedPPG(p).toFixed(1)+'</td><td>-</td><td>-</td><td>-</td><td>'+(34-(p.id%8))+'</td><td>'+(4+(p.id%4))+'</td><td>'+(38-(p.id%7))+'</td></tr></tbody></table>'; }
  return '<table class="table"><thead><tr><th>Year</th><th>GP</th><th>Avg</th><th>Median</th><th>Low</th><th>High</th><th>Sacks</th><th>Takeaways</th><th>TD</th></tr></thead><tbody>'+yrs.map(y=>'<tr><td>'+y+'</td><td>'+p.stats[y].gp+'</td><td>'+p.stats[y].avg.toFixed(1)+'</td><td>'+p.stats[y].median.toFixed(1)+'</td><td>'+p.stats[y].low.toFixed(1)+'</td><td>'+p.stats[y].high.toFixed(1)+'</td><td>'+(34-(p.id%12)+(y==="2024"?4:y==="2025"?6:0))+'</td><td>'+(18-(p.id%6)+(y==="2024"?2:y==="2025"?3:0))+'</td><td>'+(2+(p.id%3))+'</td></tr>').join('')+'<tr><td><strong>Total 23-25</strong></td><td>'+t.gp+'</td><td>'+t.avg.toFixed(1)+'</td><td>'+t.median.toFixed(1)+'</td><td>'+t.low.toFixed(1)+'</td><td>'+t.high.toFixed(1)+'</td><td colspan="3"></td></tr><tr><td><strong><span class="tap-explain" data-explain="projection">Proj</span></strong></td><td>17</td><td>'+projectedPPG(p).toFixed(1)+'</td><td>-</td><td>-</td><td>-</td><td>'+(40-(p.id%12))+'</td><td>'+(20-(p.id%6))+'</td><td>'+(2+(p.id%3))+'</td></tr></tbody></table>';
}

function renderPlayers(){
  const posRanks=posRankMap(), pool=currentRankedPool();
  document.getElementById("poolCount").textContent=pool.length+' available from '+PLAYERS.length+' total players';
  let html='';
  pool.forEach((p,idx)=>{
    html+='<div class="player"><div class="top"><div style="flex:1"><div class="name">'+p.name+(state.favoriteTeam&&p.team===state.favoriteTeam?' <span class="favorite-tag">Favorite team</span>':'')+'</div><div class="meta">'+p.team+' • '+p.pos+' • <span class="tap-explain" data-explain="tier">Tier '+p.tier+'</span> • '+(p.pos==="DST"?'Team Defense':('Age '+p.age+' • '+yearsLabel(p)))+' • Bye '+p.bye+'</div><div style="margin-top:6px"><span class="rankpill">Overall #'+(idx+1)+'</span><span class="rankpill">Pos #'+posRanks[p.id]+'</span><span class="rankpill">ADP '+p.adp.toFixed(1)+' ('+adpRoundPick(p.adp)+')</span></div></div><div class="score">'+scorePlayer(p).toFixed(1)+'</div></div>'
      +'<div class="subgrid">'+bar('Projected FP',((projectedFantasyPoints(p)-3)/(24-3))*100)+bar('Projected PPG',(projectedPPG(p)/24)*100)+bar('Consistency',p.consistency)+bar('Upside',p.upside)+'</div>'
      +'<div class="actions"><button class="good" data-draft="'+p.id+'">Draft</button><button class="secondary" data-watch="'+p.id+'">'+(state.watch.includes(p.id)?'Watching ✓':'Watch List')+'</button><button class="secondary" data-compare="'+p.id+'">'+(state.compare.includes(p.id)?'Compared ✓':'Compare')+'</button><button class="secondary" data-open="'+p.id+'">Open Detail</button></div>'
      +'<div class="detail" id="detail-'+p.id+'"><div class="mini" style="margin-top:10px"><div style="font-weight:800;margin-bottom:6px">Detailed player view</div><div class="callout narrative"><strong>Narrative:</strong> '+playerNarrative(p)+'</div>'+statsTable(p)+'<div class="callout sleeper"><strong><span class="tap-explain" data-explain="sleeper">Sleeper score</span>:</strong> '+sleeperScore(p).toFixed(0)+'/100</div><div class="callout bust"><strong><span class="tap-explain" data-explain="bust">Bust score</span>:</strong> '+bustScore(p).toFixed(0)+'/100</div><div class="callout risk"><strong><span class="tap-explain" data-explain="injury">Injury risk</span>:</strong> '+injuryCategory(p.injuryRisk)+' ('+p.injuryRisk+'/100)</div></div></div></div>';
  });
  document.getElementById("playerList").innerHTML=html;
  document.querySelectorAll('[data-draft]').forEach(el=>el.addEventListener('click',()=>draftPlayer(Number(el.dataset.draft))));
  document.querySelectorAll('[data-watch]').forEach(el=>el.addEventListener('click',()=>toggleWatch(Number(el.dataset.watch))));
  document.querySelectorAll('[data-compare]').forEach(el=>el.addEventListener('click',()=>toggleCompare(Number(el.dataset.compare))));
  document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>toggleDetail(Number(el.dataset.open))));
}
function renderRoster(){
  const slots=assignRoster();
  document.getElementById("roster").innerHTML=slots.map(({slot,player})=>'<div class="slot"><div class="muted" style="font-weight:800;margin-bottom:6px;">'+slot.label+' • '+slot.positions.join('/')+'</div>'+(player?'<div style="font-weight:800">'+player.name+'</div><div class="muted">'+player.team+' • '+player.pos+' • Bye '+player.bye+'</div><div style="margin-top:8px;"><button class="bad" data-remove="'+player.id+'">Remove</button></div>':'<div class="empty">Open</div>')+'</div>').join('');
  document.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>removePlayer(Number(el.dataset.remove))));
}
function compareMetricDefs(){ return [["position","Position",p=>p.pos],["team","Team",p=>p.team],["age","Age",p=>p.age||"-"],["exp","Exp",p=>yearsLabel(p)],["bye","Bye",p=>p.bye],["elite","Elite Score",p=>scorePlayer(p).toFixed(1)],["projfp","Projected FP",p=>projectedFantasyPoints(p).toFixed(1)],["projppg","Projected PPG",p=>projectedPPG(p).toFixed(1)],["avg3","Avg 23-25 PPG",p=>avg3ppg(p).toFixed(1)],["gp2025","2025 GP",p=>p.stats["2025"].gp],["avg2025","2025 Avg",p=>p.stats["2025"].avg.toFixed(1)],["median2025","2025 Median",p=>p.stats["2025"].median.toFixed(1)],["low2025","2025 Low",p=>p.stats["2025"].low.toFixed(1)],["high2025","2025 High",p=>p.stats["2025"].high.toFixed(1)],["posrank","Pos Rank",p=>posRankMap()[p.id]],["adp","ADP",p=>p.adp.toFixed(1)+' ('+adpRoundPick(p.adp)+')'],["sleeper","Sleeper",p=>sleeperScore(p).toFixed(0)],["bust","Bust",p=>bustScore(p).toFixed(0)],["injury","Injury",p=>injuryCategory(p.injuryRisk)+' ('+p.injuryRisk+')']]; }
function renderMetricMenu(){ const defs=compareMetricDefs(); document.getElementById("metricMenu").innerHTML='<div class="metric-menu-grid">'+defs.map(d=>'<label class="metric-item"><input type="checkbox" data-metric="'+d[0]+'" '+(state.compareMetrics.has(d[0])?'checked':'')+'> <span>'+d[1]+'</span></label>').join('')+'</div>'; document.querySelectorAll('[data-metric]').forEach(el=>el.addEventListener('change',()=>{ if(el.checked) state.compareMetrics.add(el.dataset.metric); else state.compareMetrics.delete(el.dataset.metric); renderCompareTable(); })); }

function compareDetailHtml(p){
  return '<div class="mini compare-detail-panel">'
    + '<button class="secondary compare-detail-back" id="backToCompareBtn">Back to Compare</button>'
    + '<div style="font-weight:800;font-size:20px;margin-bottom:6px">'+p.name+'</div>'
    + '<div class="muted" style="margin-bottom:10px">'+p.team+' • '+p.pos+' • <span class="tap-explain" data-explain="tier">Tier '+p.tier+'</span> • '+(p.pos==="DST"?'Team Defense':('Age '+p.age+' • '+yearsLabel(p)))+' • Bye '+p.bye+'</div>'
    + '<div class="callout narrative"><strong>Narrative:</strong> '+playerNarrative(p)+'</div>'
    + '<div class="detail-table-wrap">' + statsTable(p) + '</div>'
    + '<div class="callout sleeper"><strong><span class="tap-explain" data-explain="sleeper">Sleeper score</span>:</strong> '+sleeperScore(p).toFixed(0)+'/100</div>'
    + '<div class="callout bust"><strong><span class="tap-explain" data-explain="bust">Bust score</span>:</strong> '+bustScore(p).toFixed(0)+'/100</div>'
    + '<div class="callout risk"><strong><span class="tap-explain" data-explain="injury">Injury risk</span>:</strong> '+injuryCategory(p.injuryRisk)+' ('+p.injuryRisk+'/100)</div>'
    + '</div>';
}
function openComparePlayerDetail(id){
  state.compareDetailPlayerId = id;
  renderCompareTable();
}

function renderCompareTable(){
  const comps=state.compare.map(getPlayer).filter(Boolean).slice(0,5);
  document.getElementById("compareSummary").textContent=comps.length?comps.map(p=>p.name+' ('+p.pos+')').join(' • '):'No players selected yet.';
  const el=document.getElementById("compareTable");
  if(state.compareDetailPlayerId){
    const p = getPlayer(state.compareDetailPlayerId);
    if(p){
      const container=document.getElementById('compareContainer'); if(container) container.innerHTML = '<div id="compareTableWrap">'+compareDetailHtml(p)+'</div>';
      const btn=document.getElementById('backToCompareBtn');
      if(btn) btn.addEventListener('click',()=>{ state.compareDetailPlayerId=null; renderCompareTable(); });
      return;
    } else {
      state.compareDetailPlayerId=null;
    }
  }
  const container=document.getElementById('compareContainer');
  if(container){ container.innerHTML = '<table class="compare-flat" id="compareTable"></table>'; }
  const table=document.getElementById("compareTable");
  if(comps.length<2){ table.innerHTML='<tbody><tr><td>Pick 2 to 5 players using Compare from the Draft Board.</td></tr></tbody>'; return; }
  const defs=new Map(compareMetricDefs().map(d=>[d[0],d]));
  const order=["position","team","age","exp","bye","elite","projfp","projppg","avg3","gp2025","avg2025","median2025","low2025","high2025","posrank","adp","sleeper","bust","injury"];
  const rows=order.filter(k=>state.compareMetrics.has(k)&&defs.has(k)).map(k=>defs.get(k));
  let html='<thead><tr><th>Metric</th>'+comps.map(p=>'<th><button class="compare-player-link" data-compare-open="'+p.id+'">'+p.name+'</button></th>').join('')+'</tr></thead><tbody>';
  rows.forEach(r=>{ html+='<tr><td><strong>'+r[1]+'</strong></td>'+comps.map(p=>'<td>'+r[2](p)+'</td>').join('')+'</tr>'; });
  html+='</tbody>';
  table.innerHTML=html;
  document.querySelectorAll('[data-compare-open]').forEach(btn=>btn.addEventListener('click',()=>openComparePlayerDetail(Number(btn.dataset.compareOpen))));
}
function renderWatch(){ const watches=state.watch.map(getPlayer).filter(Boolean); const el=document.getElementById("watchArea"); if(!watches.length){ el.innerHTML='<div class="mini">No watched players yet.</div>'; return; } el.innerHTML=watches.map(p=>'<div class="mini" style="margin-bottom:10px;"><div style="font-weight:800">'+p.name+'</div><div class="muted">'+p.team+' • '+p.pos+' • Bye '+p.bye+' • '+yearsLabel(p)+' • Score '+scorePlayer(p).toFixed(1)+'</div><div style="margin:8px 0;">Projected '+projectedFantasyPoints(p).toFixed(1)+' fantasy points • projected PPG '+projectedPPG(p).toFixed(1)+' • Avg 23-25 PPG '+avg3ppg(p).toFixed(1)+'</div><button class="bad" data-watchremove="'+p.id+'">Remove from watch list</button></div>').join(''); document.querySelectorAll('[data-watchremove]').forEach(el=>el.addEventListener('click',()=>toggleWatch(Number(el.dataset.watchremove)))); }
function renderCheatSheet(){ const top=currentRankedPool().slice(0,30); const watch=state.watch.map(getPlayer).filter(Boolean); document.getElementById("cheatSheetArea").innerHTML='<div class="mini"><strong>Top targets</strong><div style="margin-top:8px">'+top.map((p,i)=>'<div>'+String(i+1).padStart(2,"0")+'. '+p.name+' • '+p.pos+' • '+p.team+' • Bye '+p.bye+' • ADP '+p.adp.toFixed(1)+'</div>').join('')+'</div></div><div class="mini" style="margin-top:10px"><strong>Priority watch list</strong><div style="margin-top:8px">'+(watch.length?watch:top.slice(0,12)).map(p=>'<div>'+p.name+' • '+p.pos+' • '+p.team+' • Sleeper '+sleeperScore(p).toFixed(0)+' • Bust '+bustScore(p).toFixed(0)+'</div>').join('')+'</div></div>'; }
function renderDraft(){
  const searchEl = document.getElementById('search');
  if(searchEl && (!searchEl.value || searchEl.value.trim()==='')){
    state.search = '';
  }
  renderChips();
  renderRankings();
  renderPlayers();
  renderRoster();
}
function renderAll(){ renderMetrics(); renderSetup(); renderDraft(); renderMetricMenu(); renderCompareTable(); renderWatch(); renderCheatSheet(); }

function saveCurrentProfile(name){
  const profiles = JSON.parse(localStorage.getItem('fantasy_league_profiles') || '{}');
  profiles[name] = {name,format:state.format,teams:state.teams,favoriteTeam:state.favoriteTeam,slots:state.slots,flexMode:state.flexMode};
  localStorage.setItem('fantasy_league_profiles', JSON.stringify(profiles));
}
function loadProfile(name){
  const profiles = JSON.parse(localStorage.getItem('fantasy_league_profiles') || '{}');
  const p = profiles[name];
  if(!p) return false;
  state.format = p.format || DEFAULT_PROFILE.format;
  state.teams = p.teams || DEFAULT_PROFILE.teams;
  state.favoriteTeam = p.favoriteTeam || "";
  state.slots = JSON.parse(JSON.stringify(p.slots || DEFAULT_PROFILE.slots));
  state.flexMode = [...(p.flexMode || DEFAULT_PROFILE.flexMode)];
  applyTeamTheme(state.favoriteTeam);
  return true;
}
function deleteProfile(name){
  const profiles = JSON.parse(localStorage.getItem('fantasy_league_profiles') || '{}');
  delete profiles[name];
  localStorage.setItem('fantasy_league_profiles', JSON.stringify(profiles));
}

document.getElementById('search').addEventListener('input',e=>{
  state.search=e.target.value || '';
  renderDraft();
});
document.getElementById('format').addEventListener('change',e=>{state.format=e.target.value; renderAll();});
document.getElementById('teams').addEventListener('change',e=>{state.teams=Number(e.target.value); renderAll();});
document.getElementById('favoriteTeam').addEventListener('change',e=>{state.favoriteTeam=e.target.value; applyTeamTheme(state.favoriteTeam); renderAll();});
document.getElementById('slotQB').addEventListener('change',e=>{state.slots.QB=Number(e.target.value); renderAll();});
document.getElementById('slotRB').addEventListener('change',e=>{state.slots.RB=Number(e.target.value); renderAll();});
document.getElementById('slotWR').addEventListener('change',e=>{state.slots.WR=Number(e.target.value); renderAll();});
document.getElementById('slotTE').addEventListener('change',e=>{state.slots.TE=Number(e.target.value); renderAll();});
document.getElementById('slotK').addEventListener('change',e=>{state.slots.K=Number(e.target.value); renderAll();});
document.getElementById('slotDST').addEventListener('change',e=>{state.slots.DST=Number(e.target.value); renderAll();});
document.getElementById('slotFLEX').addEventListener('change',e=>{state.slots.FLEX=Number(e.target.value); renderAll();});
document.getElementById('flexMode').addEventListener('change',e=>{state.flexMode=e.target.value.split(','); renderAll();});
document.getElementById('resetTeam').addEventListener('click',()=>{state.drafted=[]; renderAll();});
document.getElementById('metricMenuBtn').addEventListener('click',()=>{ const menu=document.getElementById('metricMenu'); menu.style.display=menu.style.display==='none'?'block':'none'; });
document.getElementById('saveProfileBtn').addEventListener('click',()=>{ const name=document.getElementById('profileName').value.trim(); if(!name) return; saveCurrentProfile(name); renderSetup(); document.getElementById('savedProfiles').value=name; });
document.getElementById('loadProfileBtn').addEventListener('click',()=>{ const name=document.getElementById('savedProfiles').value; if(!name) return; if(loadProfile(name)){ renderAll(); } });
document.getElementById('deleteProfileBtn').addEventListener('click',()=>{
  const name=document.getElementById('savedProfiles').value;
  if(!name) return;
  const ok = confirm('Are you sure you want to delete the profile "' + name + '"? This cannot be undone.');
  if(!ok) return;
  deleteProfile(name);
  renderSetup();
});
document.querySelectorAll('.tab').forEach(el=>el.addEventListener('click',()=>{
  state.tab=el.dataset.tab;
  syncTabs();
  if(state.tab==='draft'){
    const searchEl = document.getElementById('search');
    if(searchEl && typeof searchEl.value === 'string' && searchEl.value === '') {
      state.search = '';
    }
    renderDraft();
  }
}));
state.search='';
ensureFavoriteTeams();

document.addEventListener('click', function(e){
  const explainEl = e.target.closest('[data-explain]');
  if(explainEl){
    e.preventDefault();
    e.stopPropagation();
    openExplainSheet(explainEl.getAttribute('data-explain'));
    return;
  }
  if(e.target && e.target.id === 'closeExplainBtn'){
    closeExplainSheet();
    return;
  }
  if(e.target && e.target.id === 'explainOverlay'){
    closeExplainSheet();
    return;
  }
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeExplainSheet();
});

applyTeamTheme(state.favoriteTeam);
syncTabs();
renderAll();
renderDraft();

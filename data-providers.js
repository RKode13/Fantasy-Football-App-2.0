(function(global){
  const existing=(global.DataProviders && typeof global.DataProviders==='object') ? global.DataProviders : {};

  function readWindowPayload(key){
    if(!global || typeof global!=='object') return null;
    if(!Object.prototype.hasOwnProperty.call(global,key)) return null;
    const payload=global[key];
    return payload===undefined ? null : payload;
  }


  let remoteAdpPromise=null;
  function parseRemoteAdpSource(raw){
    if(typeof raw!=="string") return "";
    const value=raw.trim();
    if(!value) return "";
    if(/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
    return "";
  }

  function adp(){
    const payload=readWindowPayload('EXTERNAL_ADP_PAYLOAD');
    if(payload && typeof payload==='object') return payload;

    const source=parseRemoteAdpSource(global && global.REMOTE_ADP_SOURCE);
    if(!source || typeof fetch!=="function") return null;

    if(!remoteAdpPromise){
      remoteAdpPromise=fetch(source,{cache:'no-store'})
        .then(function(res){ return res && res.ok ? res.json() : null; })
        .then(function(json){
          if(json && typeof json==='object'){
            global.EXTERNAL_ADP_PAYLOAD=json;
            return json;
          }
          return null;
        })
        .catch(function(){ return null; });
    }
    return remoteAdpPromise;
  }

  let remoteHistoricalStatsPromise=null;
  function parseRemoteHistoricalStatsSource(raw){
    if(typeof raw!=="string") return "";
    const value=raw.trim();
    if(!value) return "";
    if(/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
    return "";
  }


  function historicalStats(){
    const payload=readWindowPayload('HISTORICAL_STATS_PAYLOAD');
    if(payload && typeof payload==='object') return payload;

    const source=parseRemoteHistoricalStatsSource(global && global.REMOTE_HISTORICAL_STATS_SOURCE);
    if(!source || typeof fetch!=="function") return null;

    if(!remoteHistoricalStatsPromise){
      remoteHistoricalStatsPromise=fetch(source,{cache:'no-store'})
        .then(function(res){ return res && res.ok ? res.json() : null; })
        .then(function(json){
          if(json && typeof json==='object'){
            global.HISTORICAL_STATS_PAYLOAD=json;
            return json;
          }
          return null;
        })
        .catch(function(){ return null; });
    }
    return remoteHistoricalStatsPromise;
  }


  let remoteProjectionsPromise=null;
  function parseRemoteProjectionsSource(raw){
    if(typeof raw!=="string") return "";
    const value=raw.trim();
    if(!value) return "";
    if(/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
    return "";
  }


  function projections(){
    const payload=readWindowPayload('PROJECTIONS_PAYLOAD');
    if(payload && typeof payload==='object') return payload;

    const source=parseRemoteProjectionsSource(global && global.REMOTE_PROJECTIONS_SOURCE);
    if(!source || typeof fetch!=="function") return null;

    if(!remoteProjectionsPromise){
      remoteProjectionsPromise=fetch(source,{cache:'no-store'})
        .then(function(res){ return res && res.ok ? res.json() : null; })
        .then(function(json){
          if(json && typeof json==='object'){
            global.PROJECTIONS_PAYLOAD=json;
            return json;
          }
          return null;
        })
        .catch(function(){ return null; });
    }
    return remoteProjectionsPromise;
  }


  function blurbsNews(){
    const payload=readWindowPayload('BLURBS_NEWS_PAYLOAD');
    return payload && typeof payload==='object' ? payload : null;
  }

  existing.adp=adp;
  existing.historicalStats=historicalStats;
  existing.projections=projections;
  existing.blurbsNews=blurbsNews;
  global.DataProviders=existing;
})(typeof window!=='undefined' ? window : globalThis);

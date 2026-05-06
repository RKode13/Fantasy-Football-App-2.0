(function(global){
  const existing=(global.DataProviders && typeof global.DataProviders==='object') ? global.DataProviders : {};

  function readWindowPayload(key){
    if(!global || typeof global!=='object') return null;
    if(!Object.prototype.hasOwnProperty.call(global,key)) return null;
    const payload=global[key];
    return payload===undefined ? null : payload;
  }

  function historicalStats(){
    const payload=readWindowPayload('HISTORICAL_STATS_PAYLOAD');
    return payload && typeof payload==='object' ? payload : null;
  }

  function blurbsNews(){
    const payload=readWindowPayload('BLURBS_NEWS_PAYLOAD');
    return payload && typeof payload==='object' ? payload : null;
  }

  existing.historicalStats=historicalStats;
  existing.blurbsNews=blurbsNews;
  global.DataProviders=existing;
})(typeof window!=='undefined' ? window : globalThis);

(function(global){
  const existing=(global.DataProviders && typeof global.DataProviders==='object') ? global.DataProviders : {};

  function readWindowPayload(key){
    if(!global || typeof global!=='object') return null;
    if(!Object.prototype.hasOwnProperty.call(global,key)) return null;
    const payload=global[key];
    return payload===undefined ? null : payload;
  }

  function historicalStats(){
    return readWindowPayload('HISTORICAL_STATS_PAYLOAD');
  }

  existing.historicalStats=historicalStats;
  global.DataProviders=existing;
})(typeof window!=='undefined' ? window : globalThis);

(function attachDataProviders(globalScope){
  "use strict";

  function createStaticNoopProvider(slotName){
    return {
      name: "static-noop",
      slot: slotName,
      getPayload: function(){ return null; }
    };
  }

  var providers={
    historicalStats:{
      name:"local-window-historical-stats-overlay",
      slot:"historicalStats",
      getPayload:function(){
        return typeof globalScope.EXTERNAL_HISTORICAL_STATS_PAYLOAD!=="undefined" ? globalScope.EXTERNAL_HISTORICAL_STATS_PAYLOAD : null;
      }
    },
    adp:{
      name:"local-window-adp-overlay",
      slot:"adp",
      getPayload:function(){
        return typeof globalScope.EXTERNAL_ADP_PAYLOAD!=="undefined" ? globalScope.EXTERNAL_ADP_PAYLOAD : null;
      }
    },
    projections:createStaticNoopProvider("projections"),
    blurbsNews:createStaticNoopProvider("blurbsNews")
  };

  function getProvider(slotName){
    return Object.prototype.hasOwnProperty.call(providers,slotName)?providers[slotName]:null;
  }

  function getPayload(slotName){
    var provider=getProvider(slotName);
    if(!provider || typeof provider.getPayload!=="function") return null;
    return provider.getPayload();
  }

  globalScope.DataProviders=Object.freeze({
    slots:Object.freeze({
      historicalStats:"historicalStats",
      adp:"adp",
      projections:"projections",
      blurbsNews:"blurbsNews"
    }),
    getProvider:getProvider,
    getPayload:getPayload
  });
})(typeof window!=="undefined"?window:globalThis);

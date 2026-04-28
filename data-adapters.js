(function(global){
  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max, fallback){
    const n = num(value, fallback);
    return Math.max(min, Math.min(max, n));
  }

  function str(value, fallback){
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function toUpperCode(value, fallback){
    return str(value, fallback).toUpperCase();
  }

  function bool(value, fallback){
    return typeof value === "boolean" ? value : fallback;
  }

  function normalizePlayerIdentity(input, existing){
    const source = input || {};
    const base = existing || {};
    return {
      id: num(source.id ?? source.playerId ?? source.player_id, base.id),
      name: str(source.name ?? source.fullName ?? source.playerName, base.name),
      team: toUpperCode(source.team ?? source.teamAbbr ?? source.teamCode, base.team),
      pos: toUpperCode(source.pos ?? source.position, base.pos),
      age: clamp(source.age, 0, 99, base.age),
      yearsInLeague: clamp(source.yearsInLeague ?? source.experience ?? source.exp, 0, 30, base.yearsInLeague),
      rookie: bool(source.rookie, base.rookie),
      bye: clamp(source.bye ?? source.byeWeek ?? source.bye_week, 0, 18, base.bye)
    };
  }

  function normalizeAdpData(input, existing){
    const source = input || {};
    const base = existing || {};
    return {
      adp: num(source.adp ?? source.avgDraftPosition ?? source.averageDraftPosition, base.adp),
      adpBySource: Array.isArray(source.adpBySource) ? source.adpBySource : (Array.isArray(base.adpBySource) ? base.adpBySource : []),
      adpComposite: source.adpComposite ?? base.adpComposite ?? null,
      adpTrend: source.adpTrend ?? base.adpTrend ?? null,
      adpVolatility: source.adpVolatility ?? base.adpVolatility ?? null
    };
  }

  function normalizeBlurbData(input, existing){
    const source = input || {};
    const base = existing || {};
    return {
      blurb: str(source.blurb ?? source.note ?? source.summary, base.blurb ?? null),
      blurbUpdatedAt: str(source.blurbUpdatedAt ?? source.noteUpdatedAt ?? source.updatedAt, base.blurbUpdatedAt ?? null),
      blurbSource: str(source.blurbSource ?? source.source, base.blurbSource ?? null),
      status: str(source.status, base.status ?? null),
      depthChartRole: str(source.depthChartRole ?? source.role, base.depthChartRole ?? null),
      nameAliases: Array.isArray(source.nameAliases) ? source.nameAliases.slice() : (Array.isArray(base.nameAliases) ? base.nameAliases.slice() : [])
    };
  }

  function normalizeProjectionData(input, existing){
    const source = input || {};
    const base = existing || {};
    const incomingProj = source.proj || source.projection || {};
    const baseProj = base.proj || {};
    const incomingProj2026 = source.proj2026 || (source.projectionsExtended && source.projectionsExtended["2026"]) || {};
    const baseProj2026 = base.proj2026 || {};

    return {
      proj: {
        standard: num(incomingProj.standard, baseProj.standard),
        half: num(incomingProj.half, baseProj.half),
        ppr: num(incomingProj.ppr, baseProj.ppr)
      },
      projectionSeason: num(source.projectionSeason, base.projectionSeason),
      proj2026: {
        standard: num(incomingProj2026.standard, baseProj2026.standard),
        half: num(incomingProj2026.half, baseProj2026.half),
        ppr: num(incomingProj2026.ppr, baseProj2026.ppr)
      }
    };
  }

  function normalizeExternalPlayer(input, existing){
    const base = existing || {};
    return Object.assign(
      {},
      base,
      normalizePlayerIdentity(input, base),
      normalizeAdpData(input, base),
      normalizeBlurbData(input, base),
      normalizeProjectionData(input, base)
    );
  }

  function normalizePlayersArray(items, existingById){
    const list = Array.isArray(items) ? items : [];
    const byId = existingById || {};
    return list.map(function(item){
      const rawId = item && (item.id ?? item.playerId ?? item.player_id);
      const existing = byId[rawId] || {};
      return normalizeExternalPlayer(item, existing);
    });
  }

  global.DataAdapters = {
    normalizePlayerIdentity: normalizePlayerIdentity,
    normalizeAdpData: normalizeAdpData,
    normalizeBlurbData: normalizeBlurbData,
    normalizeProjectionData: normalizeProjectionData,
    normalizeExternalPlayer: normalizeExternalPlayer,
    normalizePlayersArray: normalizePlayersArray
  };
})(typeof window !== "undefined" ? window : globalThis);

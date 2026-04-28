(function attachDataAdapters(globalScope) {
  "use strict";

  function toTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function toUpperTrimmedString(value) {
    return toTrimmedString(value).toUpperCase();
  }

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    var parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toIntegerOrNull(value) {
    var numberValue = toNumberOrNull(value);
    return numberValue === null ? null : Math.trunc(numberValue);
  }

  function toBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      var normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return Boolean(value);
  }

  function pickFirst(source, keys) {
    if (!source || typeof source !== "object") return undefined;
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
        return source[key];
      }
    }
    return undefined;
  }

  function normalizePlayerIdentity(playerLike) {
    var input = playerLike && typeof playerLike === "object" ? playerLike : {};

    var id = toIntegerOrNull(pickFirst(input, ["id", "playerId", "player_id"]));
    var name = toTrimmedString(pickFirst(input, ["name", "fullName", "playerName", "player_name"]));
    var team = toUpperTrimmedString(pickFirst(input, ["team", "teamAbbr", "team_abbr", "teamCode"]));
    var pos = toUpperTrimmedString(pickFirst(input, ["pos", "position", "positionCode"]));

    return {
      id: id,
      name: name,
      team: team,
      pos: pos
    };
  }

  function normalizeAdpData(adpLike) {
    var input = adpLike && typeof adpLike === "object" ? adpLike : {};

    var overall = toNumberOrNull(pickFirst(input, ["overall", "adp", "avgPick", "averageDraftPosition"]));
    var ppr = toNumberOrNull(pickFirst(input, ["ppr", "adpPpr", "pprAdp"]));
    var half = toNumberOrNull(pickFirst(input, ["half", "halfPpr", "adpHalf", "halfPprAdp"]));
    var standard = toNumberOrNull(pickFirst(input, ["standard", "std", "adpStandard", "standardAdp"]));

    return {
      overall: overall,
      ppr: ppr,
      half: half,
      standard: standard
    };
  }

  function normalizeBlurbData(blurbLike) {
    var input = blurbLike && typeof blurbLike === "object" ? blurbLike : {};

    return {
      summary: toTrimmedString(pickFirst(input, ["summary", "blurb", "note", "text"])),
      source: toTrimmedString(pickFirst(input, ["source", "publisher", "provider"])),
      updatedAt: toTrimmedString(pickFirst(input, ["updatedAt", "updated_at", "timestamp", "date"]))
    };
  }

  function normalizeProjectionData(projectionLike) {
    var input = projectionLike && typeof projectionLike === "object" ? projectionLike : {};

    return {
      standard: toNumberOrNull(pickFirst(input, ["standard", "std"])),
      half: toNumberOrNull(pickFirst(input, ["half", "halfPpr", "half_ppr"])),
      ppr: toNumberOrNull(pickFirst(input, ["ppr", "fullPpr", "full_ppr"]))
    };
  }

  function normalizeExternalPlayer(playerLike) {
    var input = playerLike && typeof playerLike === "object" ? playerLike : {};
    var identity = normalizePlayerIdentity(input);

    return {
      id: identity.id,
      name: identity.name,
      team: identity.team,
      pos: identity.pos,
      age: toIntegerOrNull(pickFirst(input, ["age"])),
      yearsInLeague: toIntegerOrNull(pickFirst(input, ["yearsInLeague", "experience", "exp"])),
      rookie: toBoolean(pickFirst(input, ["rookie", "isRookie"])),
      bye: toIntegerOrNull(pickFirst(input, ["bye", "byeWeek", "bye_week"])),
      adp: normalizeAdpData(pickFirst(input, ["adpData", "adp", "adp_info"])).overall,
      proj: normalizeProjectionData(pickFirst(input, ["proj", "projection", "projections"])),
      blurb: normalizeBlurbData(pickFirst(input, ["blurb", "news", "note"]))
    };
  }

  function normalizePlayersArray(playersLike) {
    if (!Array.isArray(playersLike)) {
      return [];
    }

    return playersLike.map(normalizeExternalPlayer);
  }

  globalScope.DataAdapters = Object.freeze({
    normalizePlayerIdentity: normalizePlayerIdentity,
    normalizeAdpData: normalizeAdpData,
    normalizeBlurbData: normalizeBlurbData,
    normalizeProjectionData: normalizeProjectionData,
    normalizeExternalPlayer: normalizeExternalPlayer,
    normalizePlayersArray: normalizePlayersArray
  });
})(typeof window !== "undefined" ? window : globalThis);

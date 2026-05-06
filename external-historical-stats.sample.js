/*
Sample historical stats overlay payload.

Copy records from this file into external-historical-stats.local.js to test
local historical stats overlays without changing default behavior.
*/
window.HISTORICAL_STATS_PAYLOAD_SAMPLE = {
  records: [
    {
      id: 1,
      name: "Christian McCaffrey",
      stats: {
        "2025": { avg: 20.2, gp: 15 }
      }
    },
    {
      id: 7,
      name: "Amon-Ra St. Brown",
      stats: {
        "2025": { avg: 17.4, gp: 17 }
      }
    }
  ]
};

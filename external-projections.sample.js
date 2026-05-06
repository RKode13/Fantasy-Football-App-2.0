/*
Sample projections overlay payload.

Copy records from this file into external-projections.local.js to test
local projections overlays without changing default behavior.
*/
window.PROJECTIONS_PAYLOAD_SAMPLE = {
  records: [
    {
      id: 1,
      name: "Christian McCaffrey",
      proj: { standard: 275.4, half: 308.9, ppr: 342.1 }
    },
    {
      id: 7,
      name: "Amon-Ra St. Brown",
      proj: { standard: 242.7, half: 285.2, ppr: 327.8 }
    }
  ]
};

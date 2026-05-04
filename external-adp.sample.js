/* Optional local ADP overlay sample.
   Copy this file to external-adp.local.js and edit values as needed.
   The app will load external-adp.local.js if present.
*/
window.EXTERNAL_ADP_PAYLOAD = {
  records: [
    { name: "Christian McCaffrey", team: "SF", pos: "RB", adp: 2.4 },
    { name: "CeeDee Lamb", team: "DAL", pos: "WR", adp: 4.8 },
    { name: "Josh Allen", team: "BUF", pos: "QB", adpData: { overall: 23.1 } },
    { name: "Sam LaPorta", team: "DET", pos: "TE", averageDraftPosition: 36.7 }
  ]
};

// Enterprise deployment switches: hide community marketing surfaces and
// non-core experimental modules. Flip a value to `true` to restore upstream
// behaviour; keep this file as the single place controlling product scope.
export const ENTERPRISE_FEATURES = {
  // Slack / Discord / GitHub promotion buttons (navbar, dashboard header, notification bell).
  communityLinks: false,
  // "Cloud Coding Agent" (moyai) entry in the workspace switcher.
  cloudCodingAgent: false,
  // Sidebar pages hidden from the enterprise build (by menu item key).
  hiddenNavItems: new Set<string>([
    "model-insights", // Model Leaderboard
    "lens", // Lens agent activity viewer
    "learning-resources", // external cookbook link
    "experimental", // Experimental group incl. prompts/API playground
  ]),
};

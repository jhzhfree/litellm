// 企业版功能隐藏清单：由 proxy 配置 general_settings.enterprise_features_enabled
// 控制（后端经 /get/ui_settings 透出，前端 useEnterpriseFeatures 读取，默认关闭）。
// 关闭时下列导航项与营销面全部隐藏；开启后恢复上游行为。
export const ENTERPRISE_NAV_KEYS: ReadonlySet<string> = new Set([
  "model-insights", // Model Leaderboard
  "lens", // Lens agent activity viewer
  "learning-resources", // external cookbook link
  "experimental", // Experimental group incl. prompts/API playground
  "organizations", // 企业版组织管理
  "projects", // Beta 模块
  "telemetry", // 遥测
]);

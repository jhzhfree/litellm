import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { getUiSettings } from "@/components/networking";

/**
 * 企业版功能总开关（来自后端 /get/ui_settings，源头为 proxy 配置
 * general_settings.enterprise_features_enabled，默认关闭）。
 *
 * 关闭：隐藏组织管理、模型排行榜、Lens、Projects、遥测、学习资源、
 *       社区/文档链接、Beta 标识、区域中断告警、账户菜单"隐藏***"开关等企业功能。
 * 开启：全部显示。
 */

const LOCAL_CACHE_KEY = "enterprise_features_enabled";

const readCached = (): boolean => {
  try {
    return localStorage.getItem(LOCAL_CACHE_KEY) === "true";
  } catch {
    return false;
  }
};

const ENTERPRISE_FEATURES_QUERY_KEY = ["enterprise_features_enabled"] as const;

/**
 * 返回企业版功能是否开启（默认关闭）。
 * 同步初始值取 localStorage 缓存，避免企业部署开启后首屏闪烁。
 */
export const useEnterpriseFeatures = (): boolean => {
  const { accessToken } = useAuthorized();
  const [cachedEnabled] = useState(readCached);

  const { data, isSuccess } = useQuery<boolean>({
    queryKey: ENTERPRISE_FEATURES_QUERY_KEY,
    queryFn: async () => {
      const settings = await getUiSettings();
      const enabled = Boolean(
        (settings as { values?: Record<string, unknown> } | null)?.values?.enterprise_features_enabled,
      );
      try {
        localStorage.setItem(LOCAL_CACHE_KEY, enabled ? "true" : "false");
      } catch {
        /* 隐私模式下忽略 */
      }
      return enabled;
    },
    enabled: Boolean(accessToken),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

  return isSuccess ? Boolean(data) : cachedEnabled;
};

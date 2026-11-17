import { NAV_PRODUCT_LINK_CLASS } from "@/components/Navbar/navProductLinkClass";
import { useEnterpriseFeatures } from "@/app/(dashboard)/hooks/enterpriseFeatures/useEnterpriseFeatures";
import { ChevronDown } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

export const DOCS_URL = "/docs";

const ChevronWidthSpacer: React.FC = () => (
  <ChevronDown className="pointer-events-none size-2.5 opacity-0" aria-hidden />
);

// 企业版功能开关（general_settings.enterprise_features_enabled）关闭时隐藏文档入口
export const DocsLink: React.FC = () => {
  const { t } = useTranslation();
  const enterpriseEnabled = useEnterpriseFeatures();
  if (!enterpriseEnabled) return null;
  return (
    <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className={NAV_PRODUCT_LINK_CLASS}>
      {t("shell.docsLink.label")}
      <ChevronWidthSpacer />
    </a>
  );
};

export default DocsLink;

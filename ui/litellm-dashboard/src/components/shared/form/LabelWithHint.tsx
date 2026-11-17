"use client";

import { CircleHelp } from "lucide-react";
import React from "react";

import { useEnterpriseFeatures } from "@/app/(dashboard)/hooks/enterpriseFeatures/useEnterpriseFeatures";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const hintIconClassName = "size-3.5 shrink-0 cursor-help text-muted-foreground";

export const labelWithHint = (label: React.ReactNode, hint: React.ReactNode): React.ReactNode => (
  <>
    {label}
    <Tooltip>
      <TooltipTrigger render={<CircleHelp className={hintIconClassName} />} />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  </>
);

// 企业版功能开关（general_settings.enterprise_features_enabled）关闭时不渲染跳转文档的链接，
// 仅保留提示图标与 tooltip。
export const LabelWithDocsHint: React.FC<{
  label: React.ReactNode;
  hint: React.ReactNode;
  href: string;
}> = ({ label, hint, href }) => {
  const enterpriseEnabled = useEnterpriseFeatures();
  return (
    <>
      {label}
      <Tooltip>
        <TooltipTrigger
          render={
            enterpriseEnabled ? (
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                <CircleHelp className={hintIconClassName} />
              </a>
            ) : (
              <CircleHelp className={hintIconClassName} />
            )
          }
        />
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </>
  );
};

export const labelWithDocsHint = (label: React.ReactNode, hint: React.ReactNode, href: string): React.ReactNode => (
  <LabelWithDocsHint label={label} hint={hint} href={href} />
);

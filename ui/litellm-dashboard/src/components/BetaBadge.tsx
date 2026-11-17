import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useDisableShowNewBadge } from "@/app/(dashboard)/hooks/useDisableShowNewBadge";
import { useEnterpriseFeatures } from "@/app/(dashboard)/hooks/enterpriseFeatures/useEnterpriseFeatures";

export default function BetaBadge({ children, dot = false }: { children?: React.ReactNode; dot?: boolean }) {
  const { t } = useTranslation();
  const disableShowNewBadge = useDisableShowNewBadge();
  // Beta 标识属于企业版功能：总开关关闭时一律隐藏
  const enterpriseEnabled = useEnterpriseFeatures();

  if (!enterpriseEnabled || disableShowNewBadge) {
    return children ? <>{children}</> : null;
  }

  const badge = dot ? <Badge className="size-1.5 p-0" /> : <Badge>{t("betaBadge.label")}</Badge>;

  return children ? (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {badge}
    </span>
  ) : (
    badge
  );
}

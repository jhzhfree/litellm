"use client";

import { Page, PageTabs, PageTabsList, PageTabsTrigger } from "@/components/shared/Page";
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { Info, PiggyBank } from "lucide-react";

import useCan from "@/app/(dashboard)/hooks/useCan";
import { Alert, AlertDescription } from "@/components/shared/Alert";
import { TabsContent } from "@/components/ui/tabs";
import { PageHeader, PageHeaderControls, PageHeaderDescription, PageHeaderTitle } from "@/components/shared/PageHeader";
import UsageTab from "./UsageTab";
import PromptCompressionTab from "./PromptCompressionTab";
import PromptCachingTab from "./PromptCachingTab";
import AutoRouterBenchmarksTab from "./AutoRouterBenchmarksTab";
import { useDailyActivityRange } from "./useDailyActivityRange";

interface CostOptimizationViewProps {
  accessToken: string | null;
  userId: string | null;
  userRole: string;
}

const CostOptimizationView: React.FC<CostOptimizationViewProps> = ({ accessToken, userId, userRole }) => {
  const { t } = useTranslation();
  const activity = useDailyActivityRange(accessToken, userId, userRole);
  const canViewProxyWideCostData = useCan("viewProxyWideCostData");
  const [visitedTabs, setVisitedTabs] = React.useState<readonly string[]>(["usage"]);

  const handleTabChange = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }

    setVisitedTabs((currentTabs) => (currentTabs.includes(value) ? currentTabs : [...currentTabs, value]));
  };

  return (
    <Page>
      <PageTabs defaultValue="usage" onValueChange={handleTabChange}>
        <PageHeader>
          <PageHeaderTitle>
            <PiggyBank />
            {t("costOptimization.view.title")}
          </PageHeaderTitle>
          <PageHeaderDescription>{t("costOptimization.view.description")}</PageHeaderDescription>
          <PageHeaderControls>
            <PageTabsList>
              <PageTabsTrigger value="usage">{t("costOptimization.view.tabs.overall")}</PageTabsTrigger>
              {canViewProxyWideCostData && (
                <>
                  <PageTabsTrigger value="compression">{t("costOptimization.view.tabs.compression")}</PageTabsTrigger>
                  <PageTabsTrigger value="caching">{t("costOptimization.view.tabs.caching")}</PageTabsTrigger>
                  <PageTabsTrigger value="autorouter-usage">
                    {t("costOptimization.view.tabs.autoRouter")}
                  </PageTabsTrigger>
                </>
              )}
            </PageTabsList>
          </PageHeaderControls>
        </PageHeader>

        {activity.failed && (
          <Alert variant="error">
            <AlertDescription className="text-inherit">{t("costOptimization.view.fetchFailed")}</AlertDescription>
          </Alert>
        )}
        <TabsContent value="usage" keepMounted={visitedTabs.includes("usage")}>
          <UsageTab accessToken={accessToken} activity={activity} />
        </TabsContent>
        {canViewProxyWideCostData && (
          <>
            <TabsContent value="compression" keepMounted={visitedTabs.includes("compression")}>
              <PromptCompressionTab accessToken={accessToken} />
            </TabsContent>
            <TabsContent value="caching" keepMounted={visitedTabs.includes("caching")}>
              <PromptCachingTab accessToken={accessToken} activity={activity} />
            </TabsContent>
            <TabsContent value="autorouter-usage" keepMounted={visitedTabs.includes("autorouter-usage")}>
              <AutoRouterBenchmarksTab accessToken={accessToken} activity={activity} />
            </TabsContent>
          </>
        )}
      </PageTabs>
    </Page>
  );
};

export default CostOptimizationView;

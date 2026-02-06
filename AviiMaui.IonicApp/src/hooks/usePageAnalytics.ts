import { useCallback } from "react";
import { mauiBridgeService } from "../services/MauiBridgeService";

export const usePageAnalytics = () => {
  return useCallback(
    async (
      eventName: string,
      parameters?: Record<string, string | number | boolean | null | undefined>,
    ) => {
      const res = await mauiBridgeService.trackAnalyticsEvent(
        eventName,
        parameters,
      );
      if (res.error) {
        // eslint-disable-next-line no-console
        console.warn("trackAnalyticsEvent failed", res.error);
      }
    },
    [],
  );
};

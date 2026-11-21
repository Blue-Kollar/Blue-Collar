"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useSendWebVital } from "@/hooks/useSendWebVital";

export default function WebVitalsReporter() {
  const sendWebVital = useSendWebVital();

  useReportWebVitals((metric) => {
    sendWebVital.mutate(metric);
  });

  return null;
}

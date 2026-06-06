export type Confidence = "high" | "medium" | "low";

export interface AutofillFields {
  counterparty: string;
  inn: string;
  kpp: string;
  legalEntity: string;
  federalLaw: string;
  resultDate: string;
  contractDate: string;
  deliveryType: string;
  deliveryDate: string;
  deliveryBatchDays: number | "";
  deliveryDays: number | "";
  paymentDelayDays: number | "";
  nationalRegime: string;
  lotDivisible: string;
  contractSecurity: string;
  applicationSecurity: string;
  warrantySecurity: string;
  warrantyMonths: number | "";
  specialAccount: string;
  deliveryNote: string;
}

export type TenderCard = AutofillFields;
export type AutofillMeta = Partial<
  Record<keyof AutofillFields, { source: string; confidence: Confidence }>
>;
export interface AutofillJob {
  jobId: string;
  status: "processing";
}
export type AutofillStatusResponse =
  | { status: "processing"; progress: string }
  | {
      status: "done";
      progress: string;
      fields: AutofillFields;
      meta: AutofillMeta;
      warnings: string[];
    }
  | { status: "error"; error: string; progress?: string };

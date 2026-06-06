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

export interface AutofillResult {
  fields: AutofillFields;
  meta: AutofillMeta;
  warnings: string[];
}

export interface AutofillJob {
  id: string;
  tenderCardId: number;
  tenderUrl: string;
  status: "processing" | "done" | "error";
  progress: string;
  result?: AutofillResult;
  error?: string;
}

export type AutofillStatusResponse =
  | { status: "processing"; progress: string }
  | ({ status: "done"; progress: string } & AutofillResult)
  | { status: "error"; error: string; progress?: string };

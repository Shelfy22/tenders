export type Confidence = "high" | "medium" | "low";

export interface AutofillFields {
  dateCreated: string;
  submissionDeadlineDate: string;
  submissionDeadlineTime: string;
  tenderUrlSource: string;
  federalLaw: string;
  stateDefenseOrder: string;
  tenderStatus: string;
  tenderStatusNote: string;
  tenderGroup: string;
  initialPrice: string;
  finalPrice: string;
  resultDate: string;
  contractDate: string;
  deliveryType: string;
  deliveryBatchDays: number | "";
  deliveryDays: number | "";
  deliveryDate: string;
  paymentDelayDays: number | "";
  lotDivisible: string;
  deliveryNote: string;
  counterpartyCode: string;
  counterpartyName: string;
  counterpartyInn: string;
  counterpartyKpp: string;
  counterpartyCkg: string;
  counterpartyPotential: string;
  deal: string;
  contract: string;
  counterpartyNote: string;
  op: string;
  legalEntity: string;
  tenderSubmittedDate: string;
  tenderWonDate: string;
  applicationSecurity: string;
  contractSecurity: string;
  warrantySecurity: string;
  warrantyMonths: number | "";
  nationalRegime: string;
  specialAccount: string;
  productDirections: string[];
}

export type TenderCard = AutofillFields;
export type AutofillMeta = Partial<
  Record<keyof AutofillFields, { source: string; confidence: Confidence; evidence?: string }>
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

export type Confidence = "high" | "medium" | "low";

export interface AutofillFields {
  seldonId: string;
  etpId: string;
  purchaseType: string;
  tenderUrl: string;
  dateCreated: string;
  submissionDeadlineDate: string;
  submissionDeadlineTime: string;
  tenderUrlSource: string;
  federalLaw: string;
  stateDefenseOrder: string;
  tenderStatus: string;
  tenderStatusReason: string;
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
  discrepancyNotes: string;
}

export type TenderCard = AutofillFields;
export type AutofillMeta = Partial<
  Record<keyof AutofillFields, { source: string; confidence: Confidence; evidence?: string }>
>;
export interface AutofillJob {
  jobId: string;
  status: "processing";
}
export interface ActiveCsvTender {
  id: number;
  batchId: number;
  fileId: number;
  rowIndex: number;
  source: Record<string, string>;
  card: TenderCard;
  discrepancyNotes: string;
  reviewedAt: string | null;
  createdAt: string;
}
export interface ActiveCsvBatchResponse {
  batch: { id: number; uploadedAt: string } | null;
  files: Array<{ id: number; fileName: string; fileIndex: number }>;
  tenders: ActiveCsvTender[];
}
export interface SavedTender {
  id: number;
  importedTenderId: number | null;
  card: TenderCard;
  discrepancyNotes: string;
  savedAt: string;
}
export interface MonthlyStats {
  month: string;
  savedCount: number;
  withDiscrepancies: number;
}
export interface TestingRecord {
  id: number;
  seldonId: string;
  kkt: string;
  employeeNote: string;
  winner: "employee" | "ai";
  modelVersion: number;
  createdAt: string;
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

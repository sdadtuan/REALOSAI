export interface PresalesPromoteSource {
  presalesId: number;
  leadId: number;
  serviceSlug: string;
  assignedAm: number | null;
  tasks: Array<Record<string, unknown>>;
  plan: Record<string, unknown>;
  alreadyConverted?: { lifecycle_id: number };
  skipSqlitePresalesUpdate?: boolean;
}

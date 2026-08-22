export interface ExportDealRoomPackBody {
  proposal_id?: number;
  format?: 'pdf';
  include_timeline?: boolean;
}

export interface DealRoomExportPackResult {
  filename: string;
  proposal_id: number | null;
}

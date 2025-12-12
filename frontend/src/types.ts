export interface DownloadJob {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  total_files: number;
  websocket_url: string;
}

export interface JobProgress {
  completed: number;
  total: number;
  percent: number;
  current_file?: number;
}

export interface FileResult {
  file_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  size?: number;
  error?: string;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: JobProgress;
  results: FileResult[];
  created_at: number;
  started_at?: number;
  completed_at?: number;
}

export interface WebSocketUpdate {
  type: 'progress' | 'completed' | 'failed';
  job_id: string;
  progress?: JobProgress;
  results?: FileResult[];
  message?: string;
}
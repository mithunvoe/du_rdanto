import Redis from "ioredis";
import { WebSocket } from "ws";

export interface DownloadJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  file_ids: number[];
  created_at: number;
  started_at?: number;
  completed_at?: number;
  callback_url?: string;
  progress: {
    completed: number;
    total: number;
    current_file?: number;
  };
  results: Array<{
    file_id: number;
    status: "pending" | "processing" | "completed" | "failed";
    download_url?: string;
    size?: number;
    error?: string;
  }>;
}

export interface JobUpdate {
  type: "progress" | "completed" | "failed";
  job_id: string;
  progress?: {
    completed: number;
    total: number;
    percent: number;
    current_file?: number;
  };
  results?: DownloadJob["results"];
  message?: string;
}

export class JobManager {
  private redis: Redis;
  private connections: Map<string, Set<WebSocket>> = new Map();

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || "redis://localhost:6379");
  }

  async createJob(fileIds: number[], callbackUrl?: string): Promise<DownloadJob> {
    const job: DownloadJob = {
      id: crypto.randomUUID(),
      status: "queued",
      file_ids: fileIds,
      created_at: Date.now(),
      callback_url: callbackUrl,
      progress: {
        completed: 0,
        total: fileIds.length,
      },
      results: fileIds.map((file_id) => ({
        file_id,
        status: "pending",
      })),
    };

    // Store job in Redis
    await this.redis.setex(`job:${job.id}`, 3600, JSON.stringify(job));
    
    // Add to processing queue
    await this.redis.lpush("queue:downloads", job.id);

    return job;
  }

  async getJob(jobId: string): Promise<DownloadJob | null> {
    const jobData = await this.redis.get(`job:${jobId}`);
    return jobData ? JSON.parse(jobData) : null;
  }

  async updateJob(jobId: string, updates: Partial<DownloadJob>): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    const updatedJob = { ...job, ...updates };
    await this.redis.setex(`job:${jobId}`, 3600, JSON.stringify(updatedJob));

    // Notify connected clients
    await this.notifyClients(jobId, {
      type: updatedJob.status === "completed" ? "completed" : 
            updatedJob.status === "failed" ? "failed" : "progress",
      job_id: jobId,
      progress: {
        completed: updatedJob.progress.completed,
        total: updatedJob.progress.total,
        percent: Math.round((updatedJob.progress.completed / updatedJob.progress.total) * 100),
        current_file: updatedJob.progress.current_file,
      },
      results: updatedJob.results,
    });
  }

  async addConnection(jobId: string, ws: WebSocket): Promise<void> {
    if (!this.connections.has(jobId)) {
      this.connections.set(jobId, new Set());
    }
    this.connections.get(jobId)!.add(ws);

    // Send current job status immediately
    const job = await this.getJob(jobId);
    if (job) {
      ws.send(JSON.stringify({
        type: "progress",
        job_id: jobId,
        progress: {
          completed: job.progress.completed,
          total: job.progress.total,
          percent: Math.round((job.progress.completed / job.progress.total) * 100),
          current_file: job.progress.current_file,
        },
        results: job.results,
      }));
    }

    // Clean up on disconnect
    ws.on("close", () => {
      this.removeConnection(jobId, ws);
    });
  }

  private removeConnection(jobId: string, ws: WebSocket): void {
    const connections = this.connections.get(jobId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.connections.delete(jobId);
      }
    }
  }

  private async notifyClients(jobId: string, update: JobUpdate): Promise<void> {
    const connections = this.connections.get(jobId);
    if (!connections) return;

    const message = JSON.stringify(update);
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  async getNextJob(): Promise<string | null> {
    const jobId = await this.redis.brpop("queue:downloads", 1);
    return jobId ? jobId[1] : null;
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
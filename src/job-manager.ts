import { Redis } from "ioredis";
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
  private subscriber: Redis | null = null;
  private connections: Map<string, Set<WebSocket>> = new Map();
  private isSubscribed: boolean = false;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || "redis://localhost:6379");
    
    // Add error handlers for better debugging
    this.redis.on("error", (err: Error) => {
      console.error("[JobManager] Redis error:", err);
    });
    
    this.redis.on("connect", () => {
      console.log("[JobManager] Redis connected");
    });
    
    this.redis.on("ready", () => {
      console.log("[JobManager] Redis ready");
    });
  }

  async createJob(fileIds: number[], callbackUrl?: string): Promise<DownloadJob> {
    try {
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

      console.log(`[JobManager] Created job ${job.id} with ${fileIds.length} files`);
      return job;
    } catch (error) {
      console.error("[JobManager] Error creating job:", error);
      throw error;
    }
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

    const update: JobUpdate = {
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
    };

    // Notify connected clients directly (if in same process)
    await this.notifyClients(jobId, update);
    
    // Also publish to Redis pub/sub (for cross-process communication)
    await this.publishUpdate(jobId, update);
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

  // Publish update to Redis pub/sub (for cross-process communication)
  private async publishUpdate(jobId: string, update: JobUpdate): Promise<void> {
    try {
      await this.redis.publish(`job:${jobId}:updates`, JSON.stringify(update));
    } catch (error) {
      console.error(`[JobManager] Error publishing update for job ${jobId}:`, error);
    }
  }

  // Subscribe to Redis pub/sub and forward updates to WebSocket clients
  // This should only be called by the main server process
  async subscribeToUpdates(): Promise<void> {
    if (this.isSubscribed) {
      console.log("[JobManager] Already subscribed to updates");
      return;
    }

    try {
      // Create a separate Redis connection for subscribing (required by ioredis)
      this.subscriber = new Redis(this.redis.options);
      
      this.subscriber.on("error", (err: Error) => {
        console.error("[JobManager] Subscriber Redis error:", err);
      });

      // Subscribe to all job update channels
      await this.subscriber.psubscribe("job:*:updates");

      this.subscriber.on("pmessage", (pattern: string, channel: string, message: string) => {
        try {
          const update: JobUpdate = JSON.parse(message);
          const jobId = update.job_id;
          
          // Forward to WebSocket clients
          this.notifyClients(jobId, update);
        } catch (error) {
          console.error(`[JobManager] Error processing pub/sub message from ${channel}:`, error);
        }
      });

      this.isSubscribed = true;
      console.log("[JobManager] Subscribed to Redis pub/sub for job updates");
    } catch (error) {
      console.error("[JobManager] Error subscribing to updates:", error);
      throw error;
    }
  }

  // Send interpolated progress update without updating job state
  async sendProgressUpdate(
    jobId: string,
    completed: number,
    total: number,
    currentFileProgress?: number, // 0-100 for current file
    currentFile?: number
  ): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    // Calculate overall progress with interpolation
    // If currentFileProgress is provided, interpolate between completed and completed+1
    let overallProgress: number;
    if (currentFileProgress !== undefined && currentFileProgress >= 0 && currentFileProgress <= 100) {
      // Interpolate: completed files + (current file progress / 100)
      overallProgress = completed + (currentFileProgress / 100);
    } else {
      overallProgress = completed;
    }

    const percent = Math.min(100, Math.round((overallProgress / total) * 100));

    const update: JobUpdate = {
      type: "progress",
      job_id: jobId,
      progress: {
        completed: Math.floor(overallProgress),
        total,
        percent,
        current_file: currentFile ?? undefined,
      },
      results: job.results,
    };

    // Notify connected clients directly (if in same process)
    await this.notifyClients(jobId, update);
    
    // Also publish to Redis pub/sub (for cross-process communication)
    // This is the key fix: workers publish updates, server forwards to WebSocket clients
    await this.publishUpdate(jobId, update);
  }

  async getNextJob(): Promise<string | null> {
    const jobId = await this.redis.brpop("queue:downloads", 1);
    return jobId ? jobId[1] : null;
  }

  async cleanup(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
      this.isSubscribed = false;
    }
    await this.redis.quit();
  }
}
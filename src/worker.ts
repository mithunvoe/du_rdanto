import { JobManager } from "./job-manager.ts";

// S3 availability check (copied from main file for worker)
const checkS3Availability = async (
  fileId: number,
): Promise<{
  available: boolean;
  s3Key: string | null;
  size: number | null;
  downloadUrl?: string;
}> => {
  const s3Key = `downloads/${String(fileId)}.zip`;
  
  // Mock mode - simulate S3 availability
  const available = fileId % 7 === 0;
  return {
    available,
    s3Key: available ? s3Key : null,
    size: available ? Math.floor(Math.random() * 10000000) + 1000 : null,
    downloadUrl: available 
      ? `https://storage.example.com/${s3Key}?token=${crypto.randomUUID()}`
      : undefined,
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class DownloadWorker {
  private jobManager: JobManager;
  private isRunning = false;

  constructor(redisUrl?: string) {
    this.jobManager = new JobManager(redisUrl);
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log("[Worker] Starting download worker...");

    while (this.isRunning) {
      try {
        const jobId = await this.jobManager.getNextJob();
        if (jobId) {
          await this.processJob(jobId);
        }
      } catch (error) {
        console.error("[Worker] Error processing job:", error);
        await sleep(5000); // Wait before retrying
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.jobManager.cleanup();
    console.log("[Worker] Download worker stopped");
  }

  private async processJob(jobId: string): Promise<void> {
    console.log(`[Worker] Processing job ${jobId}`);
    
    const job = await this.jobManager.getJob(jobId);
    if (!job) {
      console.error(`[Worker] Job ${jobId} not found`);
      return;
    }

    // Update job status to processing
    await this.jobManager.updateJob(jobId, {
      status: "processing",
      started_at: Date.now(),
    });

    try {
      // Process each file
      for (let i = 0; i < job.file_ids.length; i++) {
        const fileId = job.file_ids[i];
        console.log(`[Worker] Processing file ${fileId} (${i + 1}/${job.file_ids.length})`);

        // Update current file being processed
        await this.jobManager.updateJob(jobId, {
          progress: {
            ...job.progress,
            current_file: fileId,
          },
        });

        // Simulate processing delay (10-30 seconds per file)
        const delayMs = Math.floor(Math.random() * 20000) + 10000;
        await sleep(delayMs);

        // Check file availability
        const s3Result = await checkS3Availability(fileId);
        
        // Update job with file result
        const updatedJob = await this.jobManager.getJob(jobId);
        if (updatedJob) {
          updatedJob.results[i] = {
            file_id: fileId,
            status: s3Result.available ? "completed" : "failed",
            download_url: s3Result.downloadUrl,
            size: s3Result.size,
            error: s3Result.available ? undefined : "File not found in storage",
          };
          
          updatedJob.progress.completed = i + 1;
          
          await this.jobManager.updateJob(jobId, updatedJob);
        }
      }

      // Mark job as completed
      await this.jobManager.updateJob(jobId, {
        status: "completed",
        completed_at: Date.now(),
      });

      console.log(`[Worker] Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`[Worker] Job ${jobId} failed:`, error);
      
      await this.jobManager.updateJob(jobId, {
        status: "failed",
        completed_at: Date.now(),
      });
    }
  }
}

// Start worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new DownloadWorker();
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down worker...`);
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  worker.start().catch((error) => {
    console.error("[Worker] Fatal error:", error);
    process.exit(1);
  });
}
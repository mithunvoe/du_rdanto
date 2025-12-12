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
  private workerId: string;

  constructor(redisUrl?: string) {
    this.jobManager = new JobManager(redisUrl);
    // Generate unique worker ID for horizontal scaling identification
    this.workerId = `worker-${process.pid}-${Date.now()}`;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(`[Worker:${this.workerId}] Starting download worker...`);

    while (this.isRunning) {
      try {
        const jobId = await this.jobManager.getNextJob();
        if (jobId) {
          await this.processJob(jobId);
        }
      } catch (error) {
        console.error(`[Worker:${this.workerId}] Error processing job:`, error);
        await sleep(5000); // Wait before retrying
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.jobManager.cleanup();
    console.log(`[Worker:${this.workerId}] Download worker stopped`);
  }

  private async processJob(jobId: string): Promise<void> {
    console.log(`[Worker:${this.workerId}] Processing job ${jobId}`);
    
    const job = await this.jobManager.getJob(jobId);
    if (!job) {
      console.error(`[Worker:${this.workerId}] Job ${jobId} not found`);
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
        console.log(`[Worker:${this.workerId}] Processing file ${fileId} (${i + 1}/${job.file_ids.length})`);

        // Get current job state to preserve progress
        const currentJob = await this.jobManager.getJob(jobId);
        if (!currentJob) {
          console.error(`[Worker:${this.workerId}] Job ${jobId} not found during processing`);
          break;
        }

        // Determine the random processing time for this file FIRST (10-30 seconds)
        // This is the ACTUAL time that will be slept - use this for progress calculation
        const delayMs = Math.floor(Math.random() * 20000) + 10000;
        const delaySeconds = (delayMs / 1000).toFixed(1);
        console.log(`[Worker:${this.workerId}] Processing file ${fileId} - estimated time: ${delaySeconds}s`);

        // Update current file being processed (preserve completed count)
        await this.jobManager.updateJob(jobId, {
          progress: {
            ...currentJob.progress,
            current_file: fileId,
          },
        });

        // Start processing timer - use the ACTUAL delayMs for progress calculation
        const startTime = Date.now();
        const updateInterval = 500; // Send progress update every 500ms
        const totalUpdates = Math.ceil(delayMs / updateInterval);
        
        // Send initial progress update (0% for current file)
        await this.jobManager.sendProgressUpdate(
          jobId,
          i, // completed files (before current one)
          job.file_ids.length, // total files
          0, // current file just started (0%)
          fileId // current file ID
        );
        
        // Send interpolated progress updates during processing
        // Progress is calculated based on elapsed time vs the ACTUAL random delay time
        for (let updateIndex = 0; updateIndex < totalUpdates; updateIndex++) {
          await sleep(updateInterval);
          
          const elapsed = Date.now() - startTime;
          // Calculate progress: elapsed time / actual random delay time * 100
          // This ensures progress bar reflects the actual time being slept
          const currentFileProgress = Math.min(100, Math.max(0, Math.round((elapsed / delayMs) * 100)));
          
          // Send progress update with interpolated value based on actual delay time
          await this.jobManager.sendProgressUpdate(
            jobId,
            i, // completed files (before current one)
            job.file_ids.length, // total files
            currentFileProgress, // 0-100 based on elapsed/actual_delay
            fileId // current file ID
          );
        }
        
        // Ensure we've waited the full delay time
        const remainingTime = delayMs - (Date.now() - startTime);
        if (remainingTime > 0) {
          await sleep(remainingTime);
        }
        
        // Send final update for this file (100% complete)
        await this.jobManager.sendProgressUpdate(
          jobId,
          i,
          job.file_ids.length,
          100, // current file is 100% complete
          fileId
        );
        
        const actualTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Worker:${this.workerId}] File ${fileId} completed in ${actualTime}s (estimated: ${delaySeconds}s)`);

        // Check file availability
        const s3Result = await checkS3Availability(fileId);
        
        // Update job with file result and increment completed count
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

      console.log(`[Worker:${this.workerId}] Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`[Worker:${this.workerId}] Job ${jobId} failed:`, error);
      
      await this.jobManager.updateJob(jobId, {
        status: "failed",
        completed_at: Date.now(),
      });
    }
  }
}

// Start worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Read Redis URL from environment variable
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const worker = new DownloadWorker(redisUrl);
  
  console.log(`[Worker] Starting with Redis URL: ${redisUrl}`);
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down worker...`);
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  worker.start().catch((error) => {
    console.error(`[Worker] Fatal error:`, error);
    process.exit(1);
  });
}
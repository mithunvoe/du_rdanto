import { useState, useCallback, useRef, useEffect } from 'react';
import { DownloadJob, JobStatus, WebSocketUpdate, FileResult } from '../types';

interface UseDownloadReturn {
  status: 'idle' | 'initiating' | 'processing' | 'completed' | 'failed';
  progress: { completed: number; total: number; percent: number };
  results: FileResult[];
  error: string | null;
  startDownload: (fileIds: number[]) => Promise<void>;
  cancelDownload: () => void;
  isConnected: boolean;
}

const API_BASE = '';

export const useDownload = (): UseDownloadReturn => {
  const [status, setStatus] = useState<'idle' | 'initiating' | 'processing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0, percent: 0 });
  const [results, setResults] = useState<FileResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Polling fallback
  const startPolling = useCallback(async (jobId: string) => {
    console.log('[Download] Starting polling fallback for job:', jobId);
    
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log('[Download] Polling status for job:', jobId);
        const response = await fetch(`${API_BASE}/v1/download/status/${jobId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const jobStatus: JobStatus = await response.json();
        console.log('[Download] Polling response:', jobStatus);
        
        // Update progress
        setProgress(jobStatus.progress);
        
        // Update results
        setResults(jobStatus.results);
        
        // Update status - map backend status to frontend status
        if (jobStatus.status === 'queued') {
          setStatus('processing');
        } else if (jobStatus.status === 'processing') {
          setStatus('processing');
        } else if (jobStatus.status === 'completed') {
          setStatus('completed');
          // Stop polling when completed
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (jobStatus.status === 'failed') {
          setStatus('failed');
          // Stop polling when failed
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        
      } catch (err) {
        console.error('[Download] Polling error:', err);
        setError('Failed to fetch status updates');
      }
    }, 1500); // Poll every 1.5 seconds for more responsive updates
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback((websocketUrl: string, jobId: string) => {
    // Convert relative WebSocket URLs to absolute URLs, or fix localhost URLs
    let absoluteWsUrl = websocketUrl;
    
    if (websocketUrl.startsWith('/')) {
      // Relative path - convert to absolute WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      absoluteWsUrl = `${protocol}//${window.location.host}${websocketUrl}`;
    } else if (websocketUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
      // Backend returned localhost URL but we're not on localhost - use current host instead
      try {
        const url = new URL(websocketUrl);
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Extract the path from the original URL
        absoluteWsUrl = `${protocol}//${window.location.host}${url.pathname}${url.search}${url.hash}`;
      } catch {
        // If URL parsing fails, try to extract path manually
        const pathMatch = websocketUrl.match(/\/ws\/download\/.+$/);
        if (pathMatch) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          absoluteWsUrl = `${protocol}//${window.location.host}${pathMatch[0]}`;
        }
      }
    }
    
    console.log('[Download] Attempting WebSocket connection to:', absoluteWsUrl);
    
    try {
      const ws = new WebSocket(absoluteWsUrl);
      wsRef.current = ws;

      // Set a timeout for WebSocket connection
      const connectionTimeout = setTimeout(() => {
        console.log('[Download] WebSocket connection timeout, falling back to polling');
        ws.close();
        setIsConnected(false);
        startPolling(jobId);
      }, 5000); // 5 second timeout

      ws.onopen = () => {
        console.log('[Download] WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const update: WebSocketUpdate = JSON.parse(event.data);
          console.log('[Download] WebSocket update received:', update);
          
          if (update.progress) {
            // Update progress smoothly - the backend sends interpolated values
            setProgress(update.progress);
          }
          
          if (update.results) {
            setResults(update.results);
          }
          
          if (update.type === 'completed') {
            setStatus('completed');
            // Ensure progress is at 100% when completed
            if (update.progress) {
              setProgress({
                ...update.progress,
                percent: 100,
                completed: update.progress.total,
              });
            }
          } else if (update.type === 'failed') {
            setStatus('failed');
            setError(update.message || 'Download failed');
          } else if (update.type === 'progress') {
            setStatus('processing');
          }
        } catch (err) {
          console.error('[Download] Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[Download] WebSocket error:', error);
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        // Immediately start polling as fallback
        console.log('[Download] Starting polling fallback due to WebSocket error');
        startPolling(jobId);
      };

      ws.onclose = (event) => {
        console.log('[Download] WebSocket closed:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        
        // Always start polling when WebSocket closes (unless it was a clean close)
        if (event.code !== 1000) {
          console.log('[Download] Starting polling fallback due to WebSocket close');
          startPolling(jobId);
        }
      };
    } catch (error) {
      console.error('[Download] Failed to create WebSocket:', error);
      setIsConnected(false);
      // Start polling immediately if WebSocket creation fails
      startPolling(jobId);
    }
  }, [startPolling]);

  // Start download function
  const startDownload = useCallback(async (fileIds: number[]) => {
    try {
      // Clean up any existing connections/polling
      cleanup();
      
      setStatus('initiating');
      setError(null);
      setProgress({ completed: 0, total: fileIds.length, percent: 0 });
      setResults([]);
      
      console.log('[Download] Initiating download for files:', fileIds);
      
      // Initiate download job
      const response = await fetch(`${API_BASE}/v1/download/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_ids: fileIds }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const job: DownloadJob = await response.json();
      jobIdRef.current = job.job_id;
      
      console.log('[Download] Job initiated successfully:', job);
      
      setStatus('processing');
      
      // Try WebSocket first, with polling as fallback
      connectWebSocket(job.websocket_url, job.job_id);
      
      // Also start polling immediately as a backup (will be cleared if WebSocket works)
      setTimeout(() => {
        if (!isConnected) {
          console.log('[Download] WebSocket not connected after 2s, ensuring polling is active');
          startPolling(job.job_id);
        }
      }, 2000);
      
    } catch (err) {
      console.error('[Download] Error starting download:', err);
      setError(err instanceof Error ? err.message : 'Failed to start download');
      setStatus('failed');
    }
  }, [connectWebSocket, cleanup, isConnected, startPolling]);

  // Cancel download function
  const cancelDownload = useCallback(() => {
    cleanup();
    setStatus('idle');
    setProgress({ completed: 0, total: 0, percent: 0 });
    setResults([]);
    setError(null);
    jobIdRef.current = null;
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    status,
    progress,
    results,
    error,
    startDownload,
    cancelDownload,
    isConnected,
  };
};
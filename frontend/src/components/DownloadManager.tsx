import React, { useState } from 'react';
import { 
  Download, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Wifi, 
  WifiOff, 
  FileText, 
  Info,
  Home,
  Settings,
  BarChart3,
  Users,
  HelpCircle,
  Activity
} from 'lucide-react';
import { useDownload } from '../hooks/useDownload';
import { FileResult } from '../types';

const DownloadManager: React.FC = () => {
  const [fileIds, setFileIds] = useState<string>('70000,70007,70014,70021');
  const { 
    status, 
    progress, 
    results, 
    error, 
    startDownload, 
    cancelDownload,
    isConnected 
  } = useDownload();

  const handleStartDownload = async () => {
    const ids = fileIds
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id) && id >= 10000 && id <= 100000000);
    
    if (ids.length === 0) {
      alert('Please enter valid file IDs (10,000 to 100,000,000)');
      return;
    }
    
    await startDownload(ids);
  };

  const getStatusIcon = (fileStatus: FileResult['status']) => {
    switch (fileStatus) {
      case 'completed':
        return <CheckCircle className="w-5 h-5" style={{ color: 'var(--success-green)' }} />;
      case 'failed':
        return <AlertCircle className="w-5 h-5" style={{ color: 'var(--error-red)' }} />;
      case 'processing':
        return <Clock className="w-5 h-5 animate-spin" style={{ color: 'var(--primary-blue)' }} />;
      default:
        return <Clock className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusBadgeClass = (fileStatus: FileResult['status']) => {
    switch (fileStatus) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'processing':
        return 'status-processing';
      default:
        return 'status-pending';
    }
  };

  const completedFiles = results.filter(r => r.status === 'completed').length;
  const failedFiles = results.filter(r => r.status === 'failed').length;
  const processingFiles = results.filter(r => r.status === 'processing').length;
  const pendingFiles = results.filter(r => r.status === 'pending').length;

  // Debug logging
  console.log('[DownloadManager] Current state:', {
    status,
    progress,
    results,
    isConnected,
    completedFiles,
    failedFiles,
    processingFiles,
    pendingFiles
  });

  return (
    <>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'var(--bg-blue-gradient)' }}>
              <Download className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ background: 'var(--bg-blue-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>FileFlow</h2>
              <p className="text-xs text-secondary font-medium">Download Manager</p>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <Home className="w-5 h-5" />
            Dashboard
          </a>
          <a href="#" className="nav-item">
            <Download className="w-5 h-5" />
            Downloads
          </a>
          <a href="#" className="nav-item">
            <BarChart3 className="w-5 h-5" />
            Analytics
          </a>
          <a href="#" className="nav-item">
            <FileText className="w-5 h-5" />
            Files
          </a>
          <a href="#" className="nav-item">
            <Users className="w-5 h-5" />
            Users
          </a>
          <a href="#" className="nav-item">
            <Settings className="w-5 h-5" />
            Settings
          </a>
          <a href="#" className="nav-item">
            <HelpCircle className="w-5 h-5" />
            Help
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="header-title" style={{ background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary-blue) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Download Dashboard</h1>
            <p className="header-subtitle">Manage and monitor your file downloads in real-time</p>
          </div>
          <div className="header-actions">
            <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  WebSocket Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  Polling Mode
                </>
              )}
            </div>
            {/* Debug info */}
            {(status !== 'idle') && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                Status: {status} | Progress: {progress.percent}% | Files: {results.length}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid-4" style={{ marginBottom: '3rem' }}>
          <div className="dashboard-card stat-card">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37, 99, 235, 0.1)' }}>
                <FileText className="w-7 h-7" style={{ color: 'var(--primary-blue)' }} />
              </div>
            </div>
            <div className="stat-label">Total Files</div>
            <div className="stat-value" style={{ color: 'var(--primary-blue)' }}>{progress.total || 0}</div>
            {progress.total > 0 && (
              <div className="stat-change">+{progress.total} queued</div>
            )}
          </div>

          <div className="dashboard-card stat-card gradient-card-green">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-xl bg-white bg-opacity-20 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="stat-label">Completed</div>
            <div className="stat-value">{completedFiles}</div>
            {completedFiles > 0 && (
              <div className="stat-change">+{completedFiles} done</div>
            )}
          </div>

          <div className="dashboard-card stat-card gradient-card">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-xl bg-white bg-opacity-20 flex items-center justify-center">
                <Activity className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="stat-label">Processing</div>
            <div className="stat-value">{processingFiles}</div>
            {processingFiles > 0 && (
              <div className="stat-change">Active now</div>
            )}
          </div>

          <div className="dashboard-card stat-card gradient-card-purple">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-xl bg-white bg-opacity-20 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="stat-label">Failed</div>
            <div className="stat-value">{failedFiles}</div>
            {failedFiles > 0 && (
              <div className="stat-change">{failedFiles} errors</div>
            )}
          </div>
        </div>

        <div className="grid-3" style={{ gap: '2rem' }}>
          {/* Input Section */}
          <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
            <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Start New Download</h3>
            
            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="fileIds" className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                File IDs
              </label>
              <input
                id="fileIds"
                type="text"
                value={fileIds}
                onChange={(e) => setFileIds(e.target.value)}
                placeholder="Enter comma-separated file IDs (e.g., 70000,70007,70014,70021)"
                style={{ width: '100%', fontSize: '1rem', padding: '1rem' }}
                disabled={status === 'processing' || status === 'initiating'}
              />
              <p className="text-sm flex items-start gap-2 mt-3" style={{ color: 'var(--text-muted)' }}>
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Enter file IDs between 10,000 and 100,000,000. Files divisible by 7 are available.
              </p>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={handleStartDownload}
                disabled={status === 'processing' || status === 'initiating'}
                className="btn-primary"
                style={{ padding: '0.875rem 1.5rem', fontSize: '1rem' }}
              >
                <Download className="w-5 h-5" />
                {status === 'initiating' ? 'Starting...' : 'Start Download'}
              </button>
              
              {(status === 'processing' || status === 'initiating') && (
                <button
                  onClick={cancelDownload}
                  className="btn-danger"
                  style={{ padding: '0.875rem 1.5rem', fontSize: '1rem' }}
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              )}
            </div>

            {/* Progress Section */}
            {status !== 'idle' && (
              <div className="progress-section">
                <div className="progress-header">
                  <h4 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Download Progress</h4>
                  <span className="text-lg font-bold" style={{ color: 'var(--primary-blue)' }}>
                    {progress.percent}%
                  </span>
                </div>
                
                <div className="progress-bar progress-bar-primary">
                  <div
                    className="progress-fill progress-fill-primary"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>

                <div className="progress-stats">
                  <span className="capitalize font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Status: {status}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {progress.completed} of {progress.total} files completed
                  </span>
                </div>

                {status === 'completed' && (
                  <div className="completion-status" style={{ color: 'var(--success-green)' }}>
                    <CheckCircle className="w-6 h-6" />
                    <span>All files processed successfully!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Demo Information */}
          <div className="dashboard-card">
            <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Demo Guide</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <p className="font-semibold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Available Files:</p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '1rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>• IDs divisible by 7</li>
                  <li style={{ marginBottom: '0.5rem' }}>• 10-30 second processing</li>
                  <li style={{ marginBottom: '0.5rem' }}>• Real-time updates</li>
                </ul>
              </div>
              
              <div>
                <p className="font-semibold mb-3" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>Try These Examples:</p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '1rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>• 70000, 70007, 70014</li>
                  <li style={{ marginBottom: '0.5rem' }}>• 70001, 70002 (will fail)</li>
                  <li style={{ marginBottom: '0.5rem' }}>• Mixed: 70000, 70001</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="dashboard-card" style={{ marginTop: '2rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'var(--error-red)' }} />
              <div>
                <h4 className="font-bold mb-2 text-lg" style={{ color: 'var(--error-red)' }}>Error Occurred</h4>
                <p className="text-base" style={{ color: 'var(--error-red)' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="dashboard-card" style={{ marginTop: '2rem' }}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
              <FileText className="w-6 h-6" />
              File Results ({results.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {results.map((result) => (
                <div
                  key={result.file_id}
                  className="file-result-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(result.status)}
                      <div className="file-info">
                        <div className="file-header">
                          <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                            File {result.file_id}
                          </span>
                          <span className={`status-badge ${getStatusBadgeClass(result.status)}`}>
                            {result.status}
                          </span>
                        </div>
                        {result.size && (
                          <div className="file-details">
                            Size: {formatFileSize(result.size)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {result.error && (
                        <span className="text-sm font-medium max-w-xs truncate" style={{ color: 'var(--error-red)' }} title={result.error}>
                          {result.error}
                        </span>
                      )}
                      {result.download_url && (
                        <a
                          href={result.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-success"
                          style={{ fontSize: '0.875rem', padding: '0.75rem 1.25rem' }}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DownloadManager;
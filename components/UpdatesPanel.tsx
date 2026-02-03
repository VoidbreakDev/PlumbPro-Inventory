import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, RefreshCw, Loader2, RotateCw } from 'lucide-react';

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
}

export const UpdatesPanel: React.FC = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: 0,
    version: null,
    releaseNotes: null
  });

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      setIsElectron(true);
      // Get current version
      electronAPI.getAppVersion?.().then((version: string) => {
        setCurrentVersion(version);
      });

      // Listen for update status changes
      electronAPI.onUpdateStatus?.((status: UpdateStatus) => {
        setUpdateStatus(status);
      });

      // Listen for specific events
      electronAPI.onUpdateAvailable?.((info: any) => {
        setUpdateStatus(prev => ({
          ...prev,
          available: true,
          version: info.version,
          releaseNotes: info.releaseNotes
        }));
      });

      electronAPI.onUpdateDownloaded?.((info: any) => {
        setUpdateStatus(prev => ({
          ...prev,
          downloading: false,
          downloaded: true,
          progress: 100
        }));
      });

      electronAPI.onUpdateError?.((error: string) => {
        setUpdateStatus(prev => ({
          ...prev,
          checking: false,
          downloading: false,
          error
        }));
      });

      electronAPI.onDownloadProgress?.((progress: any) => {
        setUpdateStatus(prev => ({
          ...prev,
          downloading: true,
          progress: progress.percent || 0
        }));
      });
    }
  }, []);

  const checkForUpdates = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.checkForUpdates) {
      setUpdateStatus(prev => ({ ...prev, checking: true, error: null }));
      try {
        await electronAPI.checkForUpdates();
      } catch (error) {
        setUpdateStatus(prev => ({
          ...prev,
          checking: false,
          error: 'Failed to check for updates'
        }));
      }
    }
  };

  const downloadUpdate = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.downloadUpdate) {
      electronAPI.downloadUpdate();
      setUpdateStatus(prev => ({ ...prev, downloading: true }));
    }
  };

  const installUpdate = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.installUpdate) {
      electronAPI.installUpdate();
    }
  };

  if (!isElectron) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-slate-200 dark:bg-slate-600 rounded-xl flex items-center justify-center">
            <RotateCw className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Updates Not Available</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Automatic updates are only available in the desktop application.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Version */}
      <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Current Version</h3>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {currentVersion || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={checkForUpdates}
            disabled={updateStatus.checking || updateStatus.downloading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateStatus.checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Check for Updates</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Update Available */}
      {updateStatus.available && !updateStatus.downloaded && (
        <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-2 border-green-200 dark:border-green-800">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg">
                Update Available
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                Version <span className="font-bold text-green-600 dark:text-green-400">{updateStatus.version}</span> is ready to download.
              </p>
              {updateStatus.releaseNotes && (
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400 mb-4">
                  {updateStatus.releaseNotes}
                </div>
              )}
              {!updateStatus.downloading ? (
                <button
                  onClick={downloadUpdate}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Update</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Downloading...</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{updateStatus.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 transition-all duration-300"
                      style={{ width: `${updateStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update Downloaded */}
      {updateStatus.downloaded && (
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg">
                Update Ready to Install
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Version <span className="font-bold text-blue-600 dark:text-blue-400">{updateStatus.version}</span> has been downloaded and is ready to install.
              </p>
              <button
                onClick={installUpdate}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Restart and Install</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Up to Date */}
      {!updateStatus.available && !updateStatus.checking && !updateStatus.error && (
        <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Up to Date</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You are running the latest version of PlumbPro Inventory.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {updateStatus.error && (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Update Error</h3>
              <p className="text-sm text-red-600 dark:text-red-400">{updateStatus.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-update Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Auto-Update:</strong> The application automatically checks for updates on startup. 
          You can also use the <strong>Check for Updates</strong> button above or go to 
          <strong>PlumbPro Inventory → Check for Updates...</strong> in the menu bar.
        </p>
      </div>
    </div>
  );
};

export default UpdatesPanel;

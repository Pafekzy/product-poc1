import {
  AlertTriangle,
  RefreshCw,
  LogOut,
  ShieldAlert,
  Database,
  Info
} from 'lucide-react';
import type { User } from 'firebase/auth';

export interface AgreementErrorViewProps {
  user: User | null;
  error: string;
  onRetry: () => void;
  onSignOut: () => void;
  isLoading?: boolean;
  dbConnected?: boolean;
}

export function AgreementErrorView({
  user,
  error,
  onRetry,
  onSignOut,
  isLoading = false,
  dbConnected = false
}: AgreementErrorViewProps) {
  const userDisplay = user?.displayName || user?.email || 'Authenticated User';
  const userEmail = user?.email || '';

  return (
    <div className="min-h-screen bg-[#F5F7F9] text-[#17212B] flex flex-col font-sans overflow-x-hidden">
      {/* Top Navigation Bar - Authenticated Locked Navy Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#142C3E] text-white border-b border-[#22435D] shadow-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand & Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/images/vericommit-v-check-logo.png"
              alt="VeriCommit Logo"
              className="h-8 sm:h-9 w-auto object-contain bg-white rounded p-1 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white shrink-0">
                  VeriCommit
                </span>
                <span className="text-[10px] sm:text-xs bg-[#167D72] text-white px-1.5 py-0.5 rounded font-mono font-medium shrink-0">
                  v1.0
                </span>
              </div>
              <p className="hidden md:block text-xs text-[#DCE3E9] truncate">
                Evidence-led milestone verification.
              </p>
            </div>
          </div>

          {/* User Context & Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
            {/* Persistence Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0E1E2B] border border-[#22435D] text-[#DCE3E9]">
              <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-[#167D72]' : 'text-[#8C5E00]'}`} />
              <span>Firestore: {dbConnected ? 'Connected' : 'Connecting...'}</span>
            </div>

            <div className="flex items-center gap-2 bg-[#0E1E2B] px-3 py-1.5 rounded-lg border border-[#22435D] min-w-0">
              <span className="text-white font-medium truncate max-w-[140px] sm:max-w-[200px] text-xs">
                {userDisplay}
              </span>
              <button
                onClick={onSignOut}
                className="text-xs text-[#DCE3E9] hover:text-white flex items-center gap-1 bg-[#142C3E] px-2 py-1 rounded min-h-[36px] transition shrink-0 cursor-pointer"
                title="Sign out"
                data-testid="agreements-error-signout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Header Spacer */}
      <div className="h-16 shrink-0 w-full" aria-hidden="true" />

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 flex flex-col justify-center">
        <div
          className="bg-white rounded-2xl border border-[#F2D696] p-6 sm:p-10 shadow-xs space-y-6"
          data-testid="agreements-error-card"
        >
          {/* Error Banner */}
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF1D6] border border-[#F2D696] flex items-center justify-center mx-auto text-[#8C5E00]">
              <AlertTriangle className="w-8 h-8 text-[#8C5E00]" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FFF1D6] text-[#8C5E00] border border-[#F2D696] text-xs font-mono font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-[#8C5E00]" />
                <span>Agreement Request Error</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#142C3E] tracking-tight">
                Unable to Retrieve Funding Agreements
              </h1>
            </div>

            <p className="text-sm text-[#5B6673] leading-relaxed">
              An error occurred while verifying authorized funding agreements for{' '}
              <strong className="text-[#142C3E]">{userEmail || userDisplay}</strong>. This is a service request failure, not a confirmation of zero agreements.
            </p>
          </div>

          {/* Diagnostic Error Details */}
          <div className="max-w-xl mx-auto w-full bg-[#FDF2F2] border border-[#F8B4B4] rounded-xl p-3.5 sm:p-4 text-xs font-mono text-[#9B1C1C] break-words">
            <div className="font-semibold mb-1 flex items-center gap-1.5 text-[#771D1D]">
              <Info className="w-4 h-4 shrink-0" />
              <span>Diagnostic Details:</span>
            </div>
            <p className="pl-5 leading-relaxed">{error || 'Unknown network or service error.'}</p>
          </div>

          {/* Working Action Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onRetry}
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#167D72] hover:bg-[#12645B] text-white text-sm font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Retry Loading Agreements"
              data-testid="agreements-error-retry-btn"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Retrying verification...' : 'Retry Verification'}</span>
            </button>

            <button
              onClick={onSignOut}
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-gray-50 text-[#142C3E] border border-[#DCE3E9] text-sm font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Sign Out"
              data-testid="agreements-error-switch-account-btn"
            >
              <LogOut className="w-4 h-4 text-[#5B6673]" />
              <span>Sign In with Different Account</span>
            </button>
          </div>

          {/* Security & Isolation Notice */}
          <div className="border-t border-[#DCE3E9] pt-5">
            <div className="p-3.5 rounded-xl bg-[#FFF8E6] border border-[#F2D696] text-[#8C5E00] text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Fail-Closed Isolation Guarantee:</strong> When an agreement query fails, VeriCommit strictly fails closed.
                Sample fixtures or unverified agreements are never substituted as fallbacks during request errors.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0E1E2B] text-[#9FB3C3] border-t border-[#1C3A50] py-6 w-full text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[#7D94A6]">
          <span>VeriCommit — Fund with Evidence. Accountable human decisions for software grants.</span>
        </div>
      </footer>
    </div>
  );
}

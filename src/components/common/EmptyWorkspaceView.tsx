import {
  FolderGit2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Info,
  UserCheck,
  Database
} from 'lucide-react';
import type { User } from 'firebase/auth';

export interface EmptyWorkspaceViewProps {
  user: User | null;
  onRefresh: () => void;
  onSignOut: () => void;
  isLoading?: boolean;
  dbConnected?: boolean;
}

export function EmptyWorkspaceView({
  user,
  onRefresh,
  onSignOut,
  isLoading = false,
  dbConnected = false
}: EmptyWorkspaceViewProps) {
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
                data-testid="empty-workspace-signout-btn"
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
          className="bg-white rounded-2xl border border-[#DCE3E9] p-6 sm:p-10 shadow-xs space-y-8"
          data-testid="empty-workspace-card"
        >
          {/* Empty State Banner */}
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#EEF2F6] border border-[#DCE3E9] flex items-center justify-center mx-auto text-[#142C3E]">
              <FolderGit2 className="w-8 h-8 text-[#167D72]" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#EEF2F6] text-[#5B6673] text-xs font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#167D72]" />
                <span>Agreement-Scoped Authorization</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#142C3E] tracking-tight">
                No Active Funding Agreements
              </h1>
            </div>

            <p className="text-sm text-[#5B6673] leading-relaxed">
              You are signed in as <strong className="text-[#142C3E]">{userEmail || userDisplay}</strong>.
              This account is not currently an authorized participant on any funding agreements in the database.
            </p>
          </div>

          {/* Interactive Working Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#167D72] hover:bg-[#12645B] text-white text-sm font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Refresh Agreements"
              data-testid="empty-workspace-refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Checking for agreements...' : 'Refresh Agreements'}</span>
            </button>

            <button
              onClick={onSignOut}
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-gray-50 text-[#142C3E] border border-[#DCE3E9] text-sm font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Sign Out"
              data-testid="empty-workspace-switch-account-btn"
            >
              <LogOut className="w-4 h-4 text-[#5B6673]" />
              <span>Sign In with Different Account</span>
            </button>
          </div>

          {/* Informational Next Steps (No Fake Buttons) */}
          <div className="border-t border-[#DCE3E9] pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E9] space-y-2">
              <div className="font-semibold text-[#142C3E] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#167D72]" />
                <span>For Grantees & Builders</span>
              </div>
              <p className="text-[#5B6673] leading-relaxed">
                If your project has been funded, ensure you are signed in with the exact email address
                designated for your grant. Contact your sponsoring Grantor organization to confirm that your
                account has been added to the funding agreement.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E9] space-y-2">
              <div className="font-semibold text-[#142C3E] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#167D72]" />
                <span>For Grantors & Reviewers</span>
              </div>
              <p className="text-[#5B6673] leading-relaxed">
                To oversee milestones and conduct reviews, your account must be authorized as the responsible
                Grantor on an active agreement. Agreements and milestones are provisioned through verified governance records.
              </p>
            </div>
          </div>

          {/* Privacy & Governance Notice */}
          <div className="p-3.5 rounded-xl bg-[#FFF8E6] border border-[#F2D696] text-[#8C5E00] text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Data Isolation Guarantee:</strong> VeriCommit enforces agreement-scoped access boundaries.
              Private milestone deliverables, repository evidence, and formal decision records belonging to other
              organizations are never accessible without verified authorization.
            </p>
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

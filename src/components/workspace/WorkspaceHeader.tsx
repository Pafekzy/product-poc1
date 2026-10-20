import React from 'react';
import { Database, LogIn, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';

export interface WorkspaceHeaderProps {
  user: User | null;
  onSignOut: () => void;
  dbConnected?: boolean;
  authLoading?: boolean;
  children?: React.ReactNode;
}

export function WorkspaceHeader({
  user,
  onSignOut,
  dbConnected = false,
  authLoading = false,
  children
}: WorkspaceHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#142C3E] text-white border-b border-[#22435D] shadow-md w-full">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <img
            src="/images/vericommit-v-check-logo.png"
            alt="VeriCommit Logo"
            className="h-8 sm:h-9 w-auto object-contain bg-white rounded p-1 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-sm xs:text-base sm:text-lg tracking-tight text-white shrink-0">
                VeriCommit
              </span>
              <span className="text-[10px] sm:text-xs bg-[#167D72] text-white px-1.5 sm:px-2 py-0.5 rounded font-mono font-medium shrink-0">
                v1.0
              </span>
            </div>
            <p className="hidden md:block text-xs text-[#DCE3E9] truncate">
              Evidence-led milestone verification.
            </p>
          </div>
        </div>

        {/* Quick Context & Authentication Strip */}
        <div className="flex items-center gap-1.5 sm:gap-3 text-xs shrink-0">
          {/* Persistence Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0E1E2B] border border-[#22435D] text-[#DCE3E9]">
            <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-[#167D72]' : 'text-[#8C5E00]'}`} />
            <span>Firestore: {dbConnected ? 'Connected' : 'Connecting...'}</span>
          </div>

          {/* User Auth Info / Login */}
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2 bg-[#0E1E2B] px-2 sm:px-3 py-1.5 rounded-lg border border-[#22435D] min-w-0">
              <span className="text-white font-medium truncate max-w-[65px] xs:max-w-[90px] sm:max-w-[140px] text-xs">
                {user.displayName || user.email}
              </span>
              <button
                onClick={onSignOut}
                className="text-xs text-[#DCE3E9] hover:text-white flex items-center gap-1 bg-[#142C3E] px-2 py-1.5 rounded min-h-[36px] sm:min-h-auto transition shrink-0 cursor-pointer"
                title="Sign out"
                data-testid="workspace-header-signout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onSignOut}
              disabled={authLoading}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#167D72] text-white font-medium rounded-lg hover:bg-[#12645B] transition shadow-xs text-xs min-h-[36px] shrink-0 cursor-pointer"
              data-testid="workspace-header-signin-btn"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Sign in with Google</span>
              <span className="sm:hidden">Sign in</span>
            </button>
          )}
        </div>
      </div>

      {children}
    </header>
  );
}

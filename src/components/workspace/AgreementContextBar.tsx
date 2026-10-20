import { FolderGit2, UserCheck } from 'lucide-react';
import { BrandedDropdown } from '../BrandedDropdown';
import type { FundingAgreement } from '../../types';

export interface AgreementContextBarProps {
  agreements: FundingAgreement[];
  selectedAgreementId: string;
  onSelectAgreement: (agreementId: string) => void;
  userRole: 'Grantor' | 'Grantee' | 'Observer';
  isAuthenticated?: boolean;
  isLoading?: boolean;
}

export function AgreementContextBar({
  agreements,
  selectedAgreementId,
  onSelectAgreement,
  userRole,
  isAuthenticated = false,
  isLoading = false
}: AgreementContextBarProps) {
  return (
    <div
      className="mb-4 sm:mb-6 bg-white rounded-xl border border-[#DCE3E9] p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
      data-testid="agreement-context-bar"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 shrink-0">
          <FolderGit2 className="w-5 h-5 text-[#167D72] shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#5B6673]">Funding Agreement:</span>
        </div>
        <div className="flex-1 min-w-0 max-w-xl">
          <BrandedDropdown
            id="agreement-selector"
            value={selectedAgreementId}
            onChange={onSelectAgreement}
            disabled={isLoading}
            ariaLabel="Select Funding Agreement"
            dataTestId="agreement-selector"
            options={agreements.map(ag => ({
              value: ag.id,
              label: `[${ag.id.toUpperCase()}] ${ag.title}`,
              badge: ag.id.toUpperCase(),
              secondaryText: `${ag.grantorName} • ${ag.granteeName} • ${ag.totalCommitment}`
            }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start md:self-auto flex-wrap">
        {/* Mode Indicator */}
        <span
          data-testid="workspace-mode-indicator"
          className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border ${
            isAuthenticated
              ? 'bg-[#E6F4F2] text-[#167D72] border-[#A8DDD7]'
              : 'bg-[#EEF2F6] text-[#5B6673] border-[#DCE3E9]'
          }`}
        >
          {isAuthenticated ? 'Authenticated Scope' : 'Demo Mode (Sample)'}
        </span>

        {/* Computed Role Badge */}
        <span
          data-testid="workspace-role-badge"
          className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
            userRole === 'Grantor'
              ? 'bg-[#E6F4F2] text-[#167D72] border-[#A8DDD7]'
              : userRole === 'Grantee'
              ? 'bg-[#EAF2F8] text-[#1E5F8B] border-[#BBD5E8]'
              : 'bg-[#FFF8E6] text-[#8C5E00] border-[#F2D696]'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          Role: {userRole === 'Grantor' ? 'Grantor (Authorized Signer)' : userRole === 'Grantee' ? 'Grantee (Recipient)' : 'Observer'}
        </span>
      </div>
    </div>
  );
}

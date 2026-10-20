import {
  ShieldCheck,
  FileCheck2,
  GitPullRequest,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  LogIn,
  CheckCircle2,
  HelpCircle,
  FolderGit2
} from 'lucide-react';
import { FeatureCarousel } from '../FeatureCarousel';

export interface PublicLandingPageProps {
  onSignIn: () => void;
  onTryVeriCommit: () => void;
  isLoading?: boolean;
}

export function PublicLandingPage({
  onSignIn,
  onTryVeriCommit,
  isLoading = false
}: PublicLandingPageProps) {
  return (
    <div className="min-h-screen bg-[#F5F7F9] text-[#17212B] flex flex-col font-sans overflow-x-hidden">
      {/* Top Navigation Bar - Public Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#142C3E] text-white border-b border-[#22435D] shadow-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand & Identity */}
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
                Fund with Evidence.
              </p>
            </div>
          </div>

          {/* Public Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onSignIn}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-transparent text-[#DCE3E9] hover:text-white hover:bg-[#1E3E56] text-xs sm:text-sm font-medium rounded-lg transition min-h-[44px] cursor-pointer"
              aria-label="Sign In"
              data-testid="header-signin-btn"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>Sign In</span>
            </button>

            <button
              onClick={onTryVeriCommit}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#167D72] hover:bg-[#12645B] text-white text-xs sm:text-sm font-medium rounded-lg transition shadow-xs min-h-[44px] cursor-pointer"
              aria-label="Try VeriCommit"
              data-testid="header-try-btn"
            >
              <span>Try VeriCommit</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* Persistent Header Spacer */}
      <div className="h-16 shrink-0 w-full" aria-hidden="true" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* HERO SECTION */}
        <section className="text-center max-w-4xl mx-auto pt-4 sm:pt-8 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F2] border border-[#A8DDD7] text-[#167D72] text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Fund with Evidence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#142C3E] tracking-tight leading-tight sm:leading-tight">
            Connect agreed software milestones to observable GitHub evidence.
          </h1>

          <p className="text-base sm:text-lg text-[#5B6673] max-w-2xl mx-auto leading-relaxed">
            VeriCommit provides transparent milestone verification for software grants.
            Compare verifiable repository activity against agreed acceptance criteria with
            grounded AI assistance and an auditable process for accountable human decisions.
          </p>

          {/* Primary & Secondary Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              onClick={onTryVeriCommit}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#167D72] hover:bg-[#12645B] text-white font-semibold rounded-xl text-sm sm:text-base shadow-sm hover:shadow transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Try VeriCommit Primary Action"
              data-testid="hero-try-btn"
            >
              <span>Try VeriCommit</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-gray-50 text-[#142C3E] border border-[#DCE3E9] font-semibold rounded-xl text-sm sm:text-base shadow-xs transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Sign In Secondary Action"
              data-testid="hero-signin-btn"
            >
              <LogIn className="w-4 h-4 text-[#167D72]" />
              <span>Sign In with Google</span>
            </button>
          </div>

          <p className="text-xs text-[#5B6673] pt-1">
            Sign in with your Google account to access your authorized funding agreements and milestone reviews.
          </p>
        </section>

        {/* THREE CORE PILLARS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="bg-white p-6 rounded-2xl border border-[#DCE3E9] shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2F6] flex items-center justify-center text-[#142C3E]">
                <FolderGit2 className="w-5 h-5 text-[#167D72]" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#142C3E]">1. Agree Criteria in Advance</h2>
              <p className="text-xs sm:text-sm text-[#5B6673] leading-relaxed">
                Define explicit funding agreements connecting one responsible Grantor and one Grantee.
                Deliverables, timelines, and verifiable acceptance criteria are agreed upon before work begins.
              </p>
            </div>
            <div className="pt-4 text-xs font-mono text-[#167D72] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Explicit expectations</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DCE3E9] shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2F6] flex items-center justify-center text-[#142C3E]">
                <GitPullRequest className="w-5 h-5 text-[#167D72]" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#142C3E]">2. Inspect Observable Evidence</h2>
              <p className="text-xs sm:text-sm text-[#5B6673] leading-relaxed">
                Connect GitHub repositories to observe real pull requests, commits, and releases with provenance.
                Every factual finding links back to concrete repository artifacts.
              </p>
            </div>
            <div className="pt-4 text-xs font-mono text-[#167D72] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Grounded provenance</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#DCE3E9] shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2F6] flex items-center justify-center text-[#142C3E]">
                <UserCheck className="w-5 h-5 text-[#167D72]" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#142C3E]">3. Accountable Human Decisions</h2>
              <p className="text-xs sm:text-sm text-[#5B6673] leading-relaxed">
                AI evaluation is strictly advisory. An authorized human decision-maker for the responsible
                Grantor records the formal decision with required written reasoning in an append-only audit log.
              </p>
            </div>
            <div className="pt-4 text-xs font-mono text-[#167D72] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Human authority</span>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FEATURE & GOVERNANCE SHOWCASE */}
        <section className="space-y-4">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#142C3E]">
              Core Capabilities & Governance Invariants
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6673]">
              Explore the foundational rules that guide milestone verification and transparent reviews.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs">
            <FeatureCarousel />
          </div>
        </section>

        {/* HONEST LIMITATIONS & ETHICAL DISCLOSURES */}
        <section className="bg-white rounded-2xl border border-[#DCE3E9] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-[#DCE3E9] pb-4">
            <div className="p-2 bg-[#FFF1D6] rounded-xl text-[#8C5E00]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#142C3E]">Honest Limitations & Evaluation Principles</h2>
              <p className="text-xs text-[#5B6673]">What VeriCommit does — and what it does not promise.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E9] space-y-2">
              <div className="font-semibold text-[#142C3E] flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[#167D72]" />
                <span>AI Assessments Are Strictly Advisory</span>
              </div>
              <p className="text-[#5B6673] leading-relaxed">
                All AI evaluations carry <code className="bg-white px-1 py-0.5 rounded border border-[#DCE3E9]">human_review_required: true</code>.
                AI assists by comparing evidence to criteria, but it never approves milestones, releases funding,
                or impersonates a formal reviewer.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E9] space-y-2">
              <div className="font-semibold text-[#142C3E] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#167D72]" />
                <span>Formal Decision Authority Stays with Humans</span>
              </div>
              <p className="text-[#5B6673] leading-relaxed">
                The responsible Grantor retains exclusive milestone approval authority. An authorized decision-maker
                records the formal decision along with mandatory written justification (minimum 10 characters).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E9] space-y-2">
              <div className="font-semibold text-[#142C3E] flex items-center gap-1.5">
                <GitPullRequest className="w-4 h-4 text-[#167D72]" />
                <span>Commit Volume Does Not Equal Quality</span>
              </div>
              <p className="text-[#5B6673] leading-relaxed">
                VeriCommit does not treat commit counts or lines of code as proxies for developer productivity,
                software quality, production stability, or real-world impact.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E9] space-y-2">
              <div className="font-semibold text-[#142C3E] flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#167D72]" />
                <span>Missing Evidence Is Not Proof of Non-Performance</span>
              </div>
              <p className="text-[#5B6673] leading-relaxed">
                When repository evidence does not demonstrate an outcome, VeriCommit labels it
                <code className="bg-white px-1 py-0.5 rounded border border-[#DCE3E9] ml-1">insufficient_evidence</code>.
                Missing repository artifacts are not treated as proof that work was not done.
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="bg-[#142C3E] text-white rounded-2xl p-6 sm:p-10 text-center space-y-4 shadow-md">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to fund with verifiable evidence?</h2>
          <p className="text-xs sm:text-sm text-[#DCE3E9] max-w-xl mx-auto leading-relaxed">
            Sign in to access your authorized funding agreements, review submitted milestone evidence,
            and maintain an accountable audit trail.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onTryVeriCommit}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3 bg-[#167D72] hover:bg-[#12645B] text-white font-semibold rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Try VeriCommit Bottom CTA"
              data-testid="bottom-try-btn"
            >
              <span>Try VeriCommit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3 bg-transparent hover:bg-[#1E3E56] text-white border border-[#22435D] font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              aria-label="Sign In Bottom CTA"
              data-testid="bottom-signin-btn"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google</span>
            </button>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="bg-[#0E1E2B] text-[#9FB3C3] border-t border-[#1C3A50] py-6 sm:py-8 mt-12 w-full text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <img
              src="/images/vericommit-v-check-logo.png"
              alt="VeriCommit Logo"
              className="h-6 w-auto object-contain bg-white rounded p-0.5"
            />
            <span className="font-semibold text-white">VeriCommit</span>
            <span>— Fund with Evidence.</span>
          </div>
          <div className="text-center sm:text-right text-[#7D94A6]">
            <span>Human authority for accountable milestone verification.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

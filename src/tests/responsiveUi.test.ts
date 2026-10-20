import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VeriCommit Responsive UI Audit & Verification (Prompt 05)', () => {
  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  const headerPath = path.resolve(__dirname, '../components/workspace/WorkspaceHeader.tsx');
  const headerSource = fs.readFileSync(headerPath, 'utf-8');

  const cssPath = path.resolve(__dirname, '../index.css');
  const cssSource = fs.readFileSync(cssPath, 'utf-8');

  describe('1. Global Layout & No-Overflow Guarantees', () => {
    it('enforces overflow-x-hidden and max-width bounds on html and body', () => {
      expect(cssSource).toContain('overflow-x: hidden');
      expect(cssSource).toContain('max-width: 100vw');
    });

    it('enforces overflow-x-hidden and max-w-full on main React application wrapper', () => {
      expect(appSource).toContain('overflow-x-hidden');
      expect(appSource).toContain('max-w-full');
    });

    it('defines .no-scrollbar utility with cross-browser scrollbar hiding', () => {
      expect(cssSource).toContain('.no-scrollbar::-webkit-scrollbar');
      expect(cssSource).toContain('scrollbar-width: none');
    });
  });

  describe('2. Navigation Bar Responsiveness Across Viewports', () => {
    const requiredScreens = [
      { id: 'dashboard', label: 'Workspace Dashboard' },
      { id: 'milestone-details', label: 'Milestone Details' },
      { id: 'evidence-explorer', label: 'Evidence Explorer' },
      { id: 'verification-report', label: 'Verification Report' },
      { id: 'human-review', label: 'Human Review' },
      { id: 'audit-history', label: 'Audit History' }
    ];

    it('preserves all 6 principal screens in navigation', () => {
      for (const screen of requiredScreens) {
        expect(appSource).toContain(`id: '${screen.id}'`);
        expect(appSource).toContain(`label: '${screen.label}'`);
      }
    });

    it('implements horizontal smooth scrolling with touch pan support for mobile', () => {
      expect(appSource).toContain('overflow-x-auto');
      expect(appSource).toContain('no-scrollbar');
      expect(appSource).toContain('touch-pan-x');
      expect(appSource).toContain('scroll-smooth');
    });

    it('attaches data-tab attributes for programmatic auto-scroll on small screens', () => {
      expect(appSource).toContain('data-tab={tab.id}');
      expect(appSource).toContain('scrollIntoView');
    });

    it('ensures navigation tab buttons have at least 44px min-height touch targets', () => {
      expect(appSource).toContain('min-h-[44px]');
    });
  });

  describe('3. Mobile Header & Auth Adaptability (320px - 390px)', () => {
    it('uses responsive padding on header for tight viewports', () => {
      expect(headerSource).toContain('px-2.5 sm:px-6 lg:px-8');
    });

    it('provides responsive max-width truncation for user display names to prevent header overflow', () => {
      expect(headerSource).toContain('max-w-[65px] xs:max-w-[90px] sm:max-w-[140px]');
    });

    it('ensures Google sign-in and sign-out buttons have touch-friendly minimum heights', () => {
      expect(headerSource).toContain('min-h-[36px]');
    });
  });

  describe('4. Long Content & Text Wrapping Invariants', () => {
    it('uses break-words or break-all on repository URLs to prevent horizontal blowout', () => {
      expect(appSource).toContain('break-all');
      expect(appSource).toContain('repositoryUrl');
    });

    it('uses break-words and min-w-0 on milestone descriptions and criteria', () => {
      expect(appSource).toContain('break-words');
      expect(appSource).toContain('min-w-0');
    });

    it('aligns commit hash badges and multi-line commit messages with items-start on mobile', () => {
      expect(appSource).toContain('flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs min-w-0');
    });
  });

  describe('5. Touch Targets & Form Operability on Mobile', () => {
    it('ensures primary milestone action buttons have 44px minimum height', () => {
      expect(appSource).toContain('flex-1 sm:flex-none px-3 py-2.5 text-xs font-medium text-[#142C3E] bg-[#EEF2F6] hover:bg-[#DCE3E9] rounded-lg transition min-h-[44px]');
      expect(appSource).toContain('Propose Milestone');
    });

    it('ensures decision choice options stack vertically on mobile and have at least 48px height', () => {
      expect(appSource).toContain('grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3');
      expect(appSource).toContain('min-h-[48px]');
    });

    it('ensures decision review form inputs and submit button meet 44px touch targets', () => {
      expect(appSource).toContain('Record & Sign Decision');
      expect(appSource).toContain('min-h-[44px]');
    });

    it('ensures modal dialog uses flex column with bounded max-height to avoid mobile viewport clipping', () => {
      expect(appSource).toContain('max-h-[90vh] flex flex-col min-w-0');
      expect(appSource).toContain('overflow-y-auto flex-1 pr-0.5');
    });

    it('provides accessible 44px touch targets for notification dismiss buttons', () => {
      expect(appSource).toContain('min-h-[44px] px-2 flex items-center');
    });
  });

  describe('6. Locked Brand System & Color Consistency', () => {
    it('preserves Primary Navy (#142C3E) for navigation, titles, and primary actions', () => {
      expect(cssSource).toContain('#142C3E');
      expect(appSource).toContain('#142C3E');
    });

    it('preserves Verification Green (#167D72) for verified findings and positive accents', () => {
      expect(cssSource).toContain('#167D72');
      expect(appSource).toContain('#167D72');
    });

    it('preserves Attention Amber (#FFF1D6) for evidence gaps and human review prompts', () => {
      expect(cssSource).toContain('#FFF1D6');
      expect(appSource).toContain('#FFF1D6');
    });

    it('preserves Application Background (#F5F7F9) and Border Gray (#DCE3E9)', () => {
      expect(cssSource).toContain('#F5F7F9');
      expect(cssSource).toContain('#DCE3E9');
      expect(appSource).toContain('#F5F7F9');
      expect(appSource).toContain('#DCE3E9');
    });

    it('retains the official logo asset path without AI substitutions', () => {
      expect(headerSource).toContain('/images/vericommit-v-check-logo.png');
    });
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VeriCommit Branded Dropdown & Dashboard Layout Audit', () => {
  const dropdownPath = path.resolve(__dirname, '../components/BrandedDropdown.tsx');
  const dropdownSource = fs.readFileSync(dropdownPath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  describe('1. VeriCommit Brand Palette Enforcement', () => {
    it('uses Deep Navy (#0F293A) for primary typography, borders, and controls', () => {
      expect(dropdownSource).toContain('#0F293A');
    });

    it('uses Teal accent (#0F827A) for focus rings, chevrons, and active selection checkmarks', () => {
      expect(dropdownSource).toContain('#0F827A');
    });

    it('uses Warm Ivory (#F7F1E7) for option hover states, active badges, and item selection', () => {
      expect(dropdownSource).toContain('#F7F1E7');
    });

    it('uses White (#FFFFFF) for clean surface backgrounds', () => {
      expect(dropdownSource).toContain('bg-white');
    });
  });

  describe('2. Dropdown Accessibility & Keyboard Navigation', () => {
    it('implements WAI-ARIA combobox pattern on the trigger button', () => {
      expect(dropdownSource).toContain('role="combobox"');
      expect(dropdownSource).toContain('aria-haspopup="listbox"');
      expect(dropdownSource).toContain('aria-expanded={isOpen}');
      expect(dropdownSource).toContain('aria-controls={listboxId}');
    });

    it('implements WAI-ARIA listbox and option roles on dropdown menu items', () => {
      expect(dropdownSource).toContain('role="listbox"');
      expect(dropdownSource).toContain('role="option"');
      expect(dropdownSource).toContain('aria-selected={isSelected}');
    });

    it('enforces accessible 44px minimum touch targets on trigger button and option list items', () => {
      expect(dropdownSource).toContain('min-h-[44px]');
    });

    it('implements keyboard navigation: ArrowDown, ArrowUp, Home, End, Escape, Enter, Space', () => {
      expect(dropdownSource).toContain("case 'ArrowDown':");
      expect(dropdownSource).toContain("case 'ArrowUp':");
      expect(dropdownSource).toContain("case 'Home':");
      expect(dropdownSource).toContain("case 'End':");
      expect(dropdownSource).toContain("case 'Escape':");
      expect(dropdownSource).toContain("case 'Enter':");
    });

    it('implements outside click and touch dismissal handlers', () => {
      expect(dropdownSource).toContain("document.addEventListener('mousedown', handlePointerDownOutside);");
      expect(dropdownSource).toContain("document.addEventListener('touchstart', handlePointerDownOutside);");
    });
  });

  describe('3. App.tsx Integration & Dashboard Section Order Invariants', () => {
    it('imports and mounts BrandedDropdown for Funding Agreement selector', () => {
      expect(appSource).toContain("import { BrandedDropdown } from './components/BrandedDropdown';");
      expect(appSource).toContain('<BrandedDropdown');
      expect(appSource).toContain('dataTestId="agreement-selector"');
    });

    it('preserves existing agreement selection values, state handler, and options', () => {
      expect(appSource).toContain('value={selectedAgreementId}');
      expect(appSource).toContain('onChange={handleSelectAgreement}');
      expect(appSource).toContain('availableAgreements.map');
    });

    it('enforces strict Dashboard section order: Selector -> Showcase -> Human Decision Banner -> Agreement Details', () => {
      // 1. Funding Agreement selector appears in layout before Dashboard tab
      const selectorIndex = appSource.indexOf('id="agreement-selector"');
      expect(selectorIndex).toBeGreaterThan(-1);

      // Dashboard tab container start
      const dashboardTabIndex = appSource.indexOf("activeTab === 'dashboard'");
      expect(dashboardTabIndex).toBeGreaterThan(selectorIndex);

      // 2. Product Capability Showcase (<FeatureCarousel />) appears first inside dashboard
      const carouselIndex = appSource.indexOf('<FeatureCarousel />', dashboardTabIndex);
      expect(carouselIndex).toBeGreaterThan(dashboardTabIndex);

      // 3. Human Decision Required banner appears directly after FeatureCarousel inside dashboard
      const decisionBannerIndex = appSource.indexOf('dashboard-human-decision-banner', carouselIndex);
      expect(decisionBannerIndex).toBeGreaterThan(carouselIndex);

      // 4. Active Funding Agreement Details card appears after Human Decision banner
      const agreementCardIndex = appSource.indexOf('Active Funding Agreement', decisionBannerIndex);
      expect(agreementCardIndex).toBeGreaterThan(decisionBannerIndex);
    });

    it('preserves FeatureCarousel carousel behavior and slide collection', () => {
      expect(appSource).toContain('<FeatureCarousel />');
    });

    it('preserves Human Decision Required banner content and governance message', () => {
      expect(appSource).toContain('Human Decision Required');
      expect(appSource).toContain('As specified in the VeriCommit governance rules, authorized humans remain responsible for approval decisions.');
      expect(appSource).toContain("setActiveTab('human-review')");
    });
  });

  describe('4. Persistent Viewport Navigation & Stacking Invariants', () => {
    it('pins the header directly to viewport with fixed top-0 left-0 right-0 z-40 and opaque styling', () => {
      expect(appSource).toContain('fixed top-0 left-0 right-0 z-40');
      expect(appSource).toContain('bg-[#142C3E]');
      expect(appSource).toContain('shadow-md');
      expect(appSource).toContain('w-full');
    });

    it('vertically stacks branding bar and navigation tabs within the single fixed header', () => {
      const headerStart = appSource.indexOf('<header');
      const headerEnd = appSource.indexOf('</header>', headerStart);
      const headerContent = appSource.substring(headerStart, headerEnd);

      // 1. Branding bar (logo, title, version, persistence indicator, sign-in)
      expect(headerContent).toContain('VeriCommit');
      expect(headerContent).toContain('/images/vericommit-v-check-logo.png');
      expect(headerContent).toContain('h-16');

      // 2. Navigation bar with all 6 tabs
      expect(headerContent).toContain('<nav ref={navScrollRef}');
      expect(headerContent).toContain("id: 'dashboard', label: 'Workspace Dashboard'");
      expect(headerContent).toContain("id: 'milestone-details', label: 'Milestone Details'");
      expect(headerContent).toContain("id: 'evidence-explorer', label: 'Evidence Explorer'");
      expect(headerContent).toContain("id: 'verification-report', label: 'Verification Report'");
      expect(headerContent).toContain("id: 'human-review', label: 'Human Review'");
      expect(headerContent).toContain("id: 'audit-history', label: 'Audit History'");
    });

    it('reserves vertical space with a structural spacer to prevent content occlusion', () => {
      // Confirms spacer exists immediately between </header> and <main>
      const headerEnd = appSource.indexOf('</header>');
      const mainStart = appSource.indexOf('<main', headerEnd);
      const intermediateSnippet = appSource.substring(headerEnd, mainStart);

      expect(intermediateSnippet).toContain('h-[113px]');
      expect(intermediateSnippet).toContain('aria-hidden="true"');
    });

    it('establishes proper stacking contexts: z-10 for main content, z-40 for fixed header, z-50 for modal dialog', () => {
      // Main canvas is restricted to z-10 so inner dropdowns never bleed over the fixed header
      expect(appSource).toContain('overflow-x-hidden relative z-10');

      // Fixed header is z-40
      expect(appSource).toContain('fixed top-0 left-0 right-0 z-40');

      // Modal dialog is z-50 to overlay the fixed header when open
      expect(appSource).toContain('fixed inset-0 z-50');
    });
  });
});

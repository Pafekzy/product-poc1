import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ShieldCheck,
  FileCheck2,
  GitPullRequest,
  UserCheck,
  Users,
  Share2,
  ArrowRightCircle,
  Layers,
  AlertOctagon
} from 'lucide-react';

export interface CarouselSlide {
  id: string;
  category: string;
  storyNumber: string;
  heading: string;
  description: string;
  image: string;
  imageAlt: string;
  badge: string;
  keyTakeaway: string;
  iconName:
    | 'ShieldCheck'
    | 'GitPullRequest'
    | 'FileCheck2'
    | 'UserCheck'
    | 'Users'
    | 'Share2'
    | 'ArrowRightCircle'
    | 'Layers'
    | 'AlertOctagon';
}

export const featureSlides: CarouselSlide[] = [
  {
    id: 'agreements-milestones',
    category: 'Agreements & Milestones',
    storyNumber: '01 / 09',
    heading: 'Pre-Agreed Acceptance Criteria',
    description: 'Establish explicit funding agreements connecting one responsible Grantor and one Grantee. Milestones and unambiguous acceptance criteria are agreed upon before work begins, not invented after submission.',
    image: '/images/scenario-01-one-grantor-multiple-milestones.png',
    imageAlt: 'Funding Agreement connecting Grantor and Grantee with multiple defined milestones',
    badge: 'Scope Invariant',
    keyTakeaway: 'One Agreement • One Grantor • One Grantee',
    iconName: 'ShieldCheck'
  },
  {
    id: 'evidence-collection',
    category: 'Evidence Collection',
    storyNumber: '02 / 09',
    heading: 'Traceable Repository Evidence',
    description: 'Gather verifiable repository artifacts including pull requests, commit histories, branch diffs, and test runs. Repository text is treated as untrusted evidence rather than instructions that override rules.',
    image: '/images/VeriCommit Team Backlog Roadmap.png',
    imageAlt: 'Roadmap showing progression from agreed milestones to evidence collection',
    badge: 'Provenance Invariant',
    keyTakeaway: 'Commits • Pull Requests • CI Runs',
    iconName: 'GitPullRequest'
  },
  {
    id: 'evidence-verification',
    category: 'Evidence-Based Verification',
    storyNumber: '03 / 09',
    heading: 'Criterion-by-Criterion AI Assessment',
    description: 'AI evaluates demonstrable evidence against agreed acceptance criteria without fabricating claims. The system highlights supported progress, insufficient evidence, and uncertainty separately.',
    image: '/images/vericommit-evidence-workflow-infographic.png',
    imageAlt: 'VeriCommit Evidence Workflow comparing evidence against pre-agreed criteria',
    badge: 'Honesty Invariant',
    keyTakeaway: 'Supported • Insufficient • Uncertain',
    iconName: 'FileCheck2'
  },
  {
    id: 'human-review-audit',
    category: 'Human Review & Auditability',
    storyNumber: '04 / 09',
    heading: 'Human Authority & Traceable Decisions',
    description: 'AI informs, but authorized humans decide. Grantors record explicit justification for milestone approvals, while an append-only audit trail preserves complete relationship history.',
    image: '/images/VeriCommit Grant Flow Diagram.png',
    imageAlt: 'Grant Flow Diagram showing human decision authority and immutable audit trail',
    badge: 'Governance Invariant',
    keyTakeaway: 'Human Decision • Audit Trail • Non-transferable',
    iconName: 'UserCheck'
  },
  {
    id: 'one-grantor-multiple-grantees',
    category: 'Funding Relationships',
    storyNumber: '05 / 09',
    heading: 'One Grantor. Multiple Grantees.',
    description: 'Support funding relationships in which one grantor manages separate agreements with multiple grantees. Keep each agreement, its milestones, evidence, and decisions associated with the correct parties.',
    image: '/images/scenario-02-one-grantor-multiple-grantees.png',
    imageAlt: 'Diagram showing one Grantor entering into separate agreements with multiple Grantees',
    badge: 'Multi-Grantee Model',
    keyTakeaway: 'Isolated Agreements • Distinct Scopes • Independent Milestones',
    iconName: 'Users'
  },
  {
    id: 'multiple-grantors-one-grantee',
    category: 'Funding Relationships',
    storyNumber: '06 / 09',
    heading: 'Multiple Grantors. One Grantee.',
    description: 'Illustrate how one grantee may participate in multiple funding agreements with different grantors. Preserve the boundaries between agreements so evidence, permissions, and decisions do not cross into another funding relationship.',
    image: '/images/scenario-03-multiple-grantors-one-grantee.png',
    imageAlt: 'Diagram showing multiple independent Grantors concurrently funding separate agreements for one Grantee',
    badge: 'Concurrent Funding',
    keyTakeaway: 'Agreement Boundaries • No Cross-Exposure • Independent Lifecycles',
    iconName: 'Share2'
  },
  {
    id: 'sequential-funding',
    category: 'Funding Progression',
    storyNumber: '07 / 09',
    heading: 'Funding That Follows Verified Progress.',
    description: 'Show how funding stages can be organized in sequence, with each stage governed by its agreed milestones and review requirements. Completion of one stage should not automatically authorize the next; applicable human decisions and agreement terms remain essential.',
    image: '/images/scenario-04-sequential-funding.png',
    imageAlt: 'Timeline diagram showing sequential funding phases across agreements governed by verified milestones',
    badge: 'Sequential Model',
    keyTakeaway: 'Phased Progression • Explicit Terms • Verified Hand-offs',
    iconName: 'ArrowRightCircle'
  },
  {
    id: 'collaborative-grantor',
    category: 'Grantor Collaboration',
    storyNumber: '08 / 09',
    heading: 'Collaboration Without Losing Accountability.',
    description: 'Explore a collaborative grantor scenario while preserving clear responsibility for each agreement and decision. Treat shared participation as a domain scenario, not a claim that multi-grantor authorization has already been implemented.',
    image: '/images/scenario-05-collaborative-grantor.png',
    imageAlt: 'Diagram depicting a formally defined Collaborative Grantor entity funding a Grantee under a unified agreement',
    badge: 'Collaborative Entity',
    keyTakeaway: 'Single Responsible Entity • Documented Roles • Shared Purpose',
    iconName: 'Layers'
  },
  {
    id: 'invalid-and-valid-alternatives',
    category: 'Domain Integrity',
    storyNumber: '09 / 09',
    heading: 'Make Valid Relationships Explicit.',
    description: 'Distinguish permitted funding and milestone relationships from invalid alternatives. Enforce agreement boundaries and prevent ambiguous reassignment or ownership changes from being presented as valid workflows.',
    image: '/images/scenario-06-invalid-and-valid-alternatives.png',
    imageAlt: 'Diagram contrasting prohibited split-milestone assignments with valid single-grantor and collaborative models',
    badge: 'Integrity Boundaries',
    keyTakeaway: 'No Split Milestones • Explicit Reassignment • Auditable History',
    iconName: 'AlertOctagon'
  }
];

export function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);

  const containerRef = useRef<HTMLElement>(null);
  const totalSlides = featureSlides.length;

  // Reduced motion preference detection
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setIsAutoPlayActive(false);
      }
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          setIsAutoPlayActive(false);
        }
      };
      mediaQuery.addEventListener?.('change', handler);
      return () => {
        mediaQuery.removeEventListener?.('change', handler);
      };
    }
  }, []);

  // Autoplay progression: advances every 2 seconds when active and not paused by pointer/focus
  useEffect(() => {
    if (!isAutoPlayActive || isHovered || isFocused) {
      return;
    }

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, 2000);

    return () => {
      clearInterval(timer);
    };
  }, [isAutoPlayActive, isHovered, isFocused, resetKey, totalSlides]);

  const resetCountdown = useCallback(() => {
    setResetKey((prev) => prev + 1);
  }, []);

  const goToPrevious = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    resetCountdown();
  }, [totalSlides, resetCountdown]);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % totalSlides);
    resetCountdown();
  }, [totalSlides, resetCountdown]);

  const goToSlide = useCallback(
    (index: number) => {
      setActiveIndex(index);
      resetCountdown();
    },
    [resetCountdown]
  );

  const toggleAutoPlay = useCallback(() => {
    setIsAutoPlayActive((prev) => !prev);
    resetCountdown();
  }, [resetCountdown]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      // Toggle play/pause if space is pressed directly on the carousel container
      if (e.target === containerRef.current) {
        e.preventDefault();
        toggleAutoPlay();
      }
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsFocused(false);
    }
  };

  const currentSlide = featureSlides[activeIndex];

  const renderIcon = (iconName: CarouselSlide['iconName']) => {
    const iconClass = 'w-4 h-4 text-[#167D72] shrink-0';
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className={iconClass} />;
      case 'GitPullRequest':
        return <GitPullRequest className={iconClass} />;
      case 'FileCheck2':
        return <FileCheck2 className={iconClass} />;
      case 'UserCheck':
        return <UserCheck className={iconClass} />;
      case 'Users':
        return <Users className={iconClass} />;
      case 'Share2':
        return <Share2 className={iconClass} />;
      case 'ArrowRightCircle':
        return <ArrowRightCircle className={iconClass} />;
      case 'Layers':
        return <Layers className={iconClass} />;
      case 'AlertOctagon':
        return <AlertOctagon className={iconClass} />;
      default:
        return <ShieldCheck className={iconClass} />;
    }
  };

  // Screen-reader live region strategy:
  // When autoplay is running uninterrupted, set to 'off' to prevent verbal bombardment every 2 seconds.
  // When paused or manually controlled, set to 'polite' to announce slide changes.
  const isActivelyAutoPlaying = isAutoPlayActive && !isHovered && !isFocused;
  const liveRegionMode = isActivelyAutoPlaying ? 'off' : 'polite';

  return (
    <section
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="VeriCommit Feature Showcase"
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      className="bg-white rounded-xl border border-[#DCE3E9] p-4 sm:p-6 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167D72] focus-visible:ring-offset-2 transition-shadow"
      data-testid="feature-showcase-carousel"
    >
      {/* Header bar with title, play/pause, and story number */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE3E9] mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#E6F4F2] text-[#167D72] shrink-0">
            {renderIcon(currentSlide.iconName)}
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#142C3E] truncate">
              Product Capability Showcase
            </h2>
            <p className="text-[11px] sm:text-xs text-[#5B6673]">
              Fund with Evidence • Human-governed verification workflow
            </p>
          </div>
        </div>

        {/* Story Number & Autoplay Play/Pause Control */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Autoplay Play/Pause Button */}
          <button
            type="button"
            onClick={toggleAutoPlay}
            aria-label={isAutoPlayActive ? 'Pause autoplay' : 'Start autoplay'}
            data-testid="carousel-play-pause-btn"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#DCE3E9] rounded-lg text-xs font-medium text-[#142C3E] hover:bg-[#F5F7F9] hover:border-[#B7C6D4] min-h-[44px] min-w-[44px] justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167D72] transition shadow-2xs"
          >
            {isAutoPlayActive ? (
              <>
                <Pause className="w-3.5 h-3.5 text-[#167D72]" />
                <span className="font-mono text-[11px]">2s Auto</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#8C5E00]" />
                <span className="font-mono text-[11px] text-[#8C5E00]">Paused</span>
              </>
            )}
          </button>

          {/* Story Number Badge */}
          <span
            className="text-xs font-mono font-semibold text-[#142C3E] bg-[#EEF2F6] px-2.5 py-1.5 rounded-md min-h-[44px] flex items-center justify-center"
            data-testid="story-number"
            aria-label={`Slide ${activeIndex + 1} of ${totalSlides}`}
          >
            {currentSlide.storyNumber}
          </span>

          <span className="text-[11px] font-medium text-[#167D72] bg-[#E6F4F2] px-2.5 py-1.5 rounded-md min-h-[44px] hidden md:flex items-center">
            {currentSlide.badge}
          </span>
        </div>
      </div>

      {/* Main Slide Body: Desktop 2-column composition, Mobile Stacked */}
      <div
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center"
        aria-live={liveRegionMode}
        data-testid="carousel-active-slide"
        data-slide-id={currentSlide.id}
      >
        {/* Left Column: Text Context & Narrative */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-3 sm:space-y-4 min-w-0 order-2 lg:order-1">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold text-[#167D72] bg-[#E6F4F2] px-2.5 py-1 rounded-md tracking-wide"
                data-testid="slide-category"
              >
                {currentSlide.category}
              </span>
            </div>

            <h3
              className="text-lg sm:text-xl font-bold text-[#142C3E] leading-snug break-words"
              data-testid="slide-heading"
            >
              {currentSlide.heading}
            </h3>

            <p
              className="text-xs sm:text-sm text-[#5B6673] leading-relaxed break-words"
              data-testid="slide-description"
            >
              {currentSlide.description}
            </p>
          </div>

          {/* Key Takeaway Pill */}
          <div className="p-3 bg-[#F5F7F9] border border-[#DCE3E9] rounded-lg">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7D94A6] block mb-0.5">
              Domain Invariant
            </span>
            <div className="text-xs sm:text-sm font-medium text-[#142C3E] font-mono break-words">
              {currentSlide.keyTakeaway}
            </div>
          </div>

          {/* Interactive Navigation Row: 9 Pagination Indicators + Prev/Next Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* 9 Pagination Indicators with accessible labels and touch targets */}
            <div
              className="flex items-center flex-wrap gap-1.5"
              role="tablist"
              aria-label="Slide pagination"
              data-testid="pagination-indicators"
            >
              {featureSlides.map((slide, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(idx)}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Go to slide ${idx + 1}: ${slide.category}`}
                    aria-current={isActive ? 'true' : 'false'}
                    data-testid={`pagination-dot-${idx}`}
                    className="min-h-[44px] min-w-[28px] sm:min-w-[32px] flex items-center justify-center p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167D72] rounded-md transition-colors"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'w-6 bg-[#167D72] shadow-xs'
                          : 'w-2 bg-[#DCE3E9] hover:bg-[#B7C6D4]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={goToPrevious}
                aria-label="Previous slide"
                data-testid="carousel-prev-btn"
                className="min-h-[44px] min-w-[44px] px-3 py-2 bg-white border border-[#DCE3E9] rounded-lg text-[#142C3E] hover:bg-[#F5F7F9] hover:border-[#B7C6D4] active:translate-y-0 hover:-translate-y-0.5 transition flex items-center justify-center shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167D72]"
              >
                <ChevronLeft className="w-5 h-5 text-[#142C3E]" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next slide"
                data-testid="carousel-next-btn"
                className="min-h-[44px] min-w-[44px] px-3 py-2 bg-[#142C3E] text-white rounded-lg hover:bg-[#1E3E56] active:translate-y-0 hover:-translate-y-0.5 transition flex items-center justify-center shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167D72]"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Frame */}
        <div className="lg:col-span-6 min-w-0 order-1 lg:order-2">
          <div className="w-full bg-[#F5F7F9] rounded-xl border border-[#DCE3E9] p-3 sm:p-4 flex flex-col items-center justify-center shadow-inner min-h-[200px] sm:min-h-[260px] relative overflow-hidden group">
            <img
              src={currentSlide.image}
              alt={currentSlide.imageAlt}
              data-testid="slide-image"
              className="w-full h-auto max-h-56 sm:max-h-64 object-contain rounded-md transition-transform duration-300 motion-safe:group-hover:scale-[1.01]"
              loading="lazy"
            />
            <div className="w-full flex items-center justify-between text-[11px] text-[#5B6673] pt-2 mt-2 border-t border-[#E1E8EE] font-mono">
              <span className="truncate">{currentSlide.category}</span>
              <span className="shrink-0 text-[#167D72] font-semibold">Verified Artifact</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

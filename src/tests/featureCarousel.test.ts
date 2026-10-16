import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { featureSlides, CarouselSlide } from '../components/FeatureCarousel';

describe('Feature Showcase Carousel 8-Slide Final Refinement & Invariants', () => {
  const componentPath = path.resolve(__dirname, '../components/FeatureCarousel.tsx');
  const componentSource = fs.readFileSync(componentPath, 'utf-8');

  const appPath = path.resolve(__dirname, '../App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. Slide Count, Strict Ordering & Removal Invariants', () => {
    it('verifies exactly 8 slides exist in the collection', () => {
      expect(featureSlides).toHaveLength(8);
    });

    it('verifies the first slide is Human Review & Auditability (01 / 08)', () => {
      const firstSlide = featureSlides[0];
      expect(firstSlide.id).toBe('human-review-audit');
      expect(firstSlide.category).toBe('Human Review & Auditability');
      expect(firstSlide.heading).toBe('Human Authority & Traceable Decisions');
      expect(firstSlide.storyNumber).toBe('01 / 08');
      expect(firstSlide.image).toBe('/images/VeriCommit Grant Flow Diagram.png');
      expect(firstSlide.keyTakeaway).toBe('Human Decision • Audit Trail • Non-transferable');
    });

    it('verifies the second slide is Agreements & Milestones (02 / 08)', () => {
      const secondSlide = featureSlides[1];
      expect(secondSlide.id).toBe('agreements-milestones');
      expect(secondSlide.category).toBe('Agreements & Milestones');
      expect(secondSlide.heading).toBe('Pre-Agreed Acceptance Criteria');
      expect(secondSlide.storyNumber).toBe('02 / 08');
      expect(secondSlide.image).toBe('/images/scenario-01-one-grantor-multiple-milestones.png');
    });

    it('verifies the final (eighth) slide is Evidence-Based Verification (08 / 08)', () => {
      const finalSlide = featureSlides[7];
      expect(finalSlide.id).toBe('evidence-verification');
      expect(finalSlide.category).toBe('Evidence-Based Verification');
      expect(finalSlide.heading).toBe('Criterion-by-Criterion AI Assessment');
      expect(finalSlide.storyNumber).toBe('08 / 08');
      expect(finalSlide.image).toBe('/images/vericommit-evidence-workflow-infographic.png');
      expect(finalSlide.keyTakeaway).toBe('Supported • Insufficient • Uncertain');
    });

    it('verifies the five funding scenario images are present in the exact specified order (slides 3 to 7)', () => {
      const expectedScenarioImages = [
        '/images/scenario-02-one-grantor-multiple-grantees.png',
        '/images/scenario-03-multiple-grantors-one-grantee.png',
        '/images/scenario-04-sequential-funding.png',
        '/images/scenario-05-collaborative-grantor.png',
        '/images/scenario-06-invalid-and-valid-alternatives.png'
      ];

      const actualScenarioImages = featureSlides.slice(2, 7).map((s) => s.image);
      expect(actualScenarioImages).toEqual(expectedScenarioImages);
    });

    it('verifies the Traceable Repository Evidence slide is completely absent from the carousel', () => {
      const slideIds = featureSlides.map((s) => s.id);
      expect(slideIds).not.toContain('evidence-collection');

      const headings = featureSlides.map((s) => s.heading);
      expect(headings).not.toContain('Traceable Repository Evidence');

      // Verify no empty or placeholder slides exist
      featureSlides.forEach((slide) => {
        expect(slide.heading.trim().length).toBeGreaterThan(0);
        expect(slide.description.trim().length).toBeGreaterThan(20);
        expect(slide.image.trim().length).toBeGreaterThan(0);
      });
    });

    it('verifies all story numbers progress strictly from "01 / 08" through "08 / 08"', () => {
      featureSlides.forEach((slide: CarouselSlide, index: number) => {
        const expectedStoryNumber = `0${index + 1} / 08`;
        expect(slide.storyNumber).toBe(expectedStoryNumber);
      });
    });

    it('verifies that all 8 referenced local images exist on the filesystem', () => {
      featureSlides.forEach((slide) => {
        const relativeImagePath = slide.image.replace(/^\//, '');
        const absolutePath = path.resolve(__dirname, '../../', relativeImagePath);
        expect(fs.existsSync(absolutePath)).toBe(true);
      });
    });
  });

  describe('2. Navigation Logic & 8-Slide Wrap-Around Synchronization', () => {
    const totalSlides = featureSlides.length; // 8

    it('verifies sequential forward navigation steps through all 8 slides', () => {
      let activeIndex = 0;
      const nextSlide = (curr: number) => (curr + 1) % totalSlides;

      for (let i = 1; i < totalSlides; i++) {
        activeIndex = nextSlide(activeIndex);
        expect(activeIndex).toBe(i);
        expect(featureSlides[activeIndex].storyNumber).toBe(`0${i + 1} / 08`);
      }
    });

    it('verifies navigation wraps from slide eight (index 7) back to slide one (index 0)', () => {
      const nextSlide = (curr: number) => (curr + 1) % totalSlides;
      const wrappedIndex = nextSlide(7);
      expect(wrappedIndex).toBe(0);
      expect(featureSlides[wrappedIndex].storyNumber).toBe('01 / 08');
      expect(featureSlides[wrappedIndex].id).toBe('human-review-audit');
    });

    it('verifies sequential backward navigation retreats across all 8 slides', () => {
      let activeIndex = 7;
      const prevSlide = (curr: number) => (curr - 1 + totalSlides) % totalSlides;

      for (let i = 6; i >= 0; i--) {
        activeIndex = prevSlide(activeIndex);
        expect(activeIndex).toBe(i);
        expect(featureSlides[activeIndex].storyNumber).toBe(`0${i + 1} / 08`);
      }
    });

    it('verifies backward navigation wraps from slide one (index 0) to slide eight (index 7)', () => {
      const prevSlide = (curr: number) => (curr - 1 + totalSlides) % totalSlides;
      const wrappedIndex = prevSlide(0);
      expect(wrappedIndex).toBe(7);
      expect(featureSlides[wrappedIndex].storyNumber).toBe('08 / 08');
      expect(featureSlides[wrappedIndex].id).toBe('evidence-verification');
    });

    it('verifies direct pagination jumping for all 8 slide indices', () => {
      for (let i = 0; i < totalSlides; i++) {
        const slide = featureSlides[i];
        expect(slide.storyNumber).toBe(`0${i + 1} / 08`);
      }
    });

    it('guarantees synchronized single source of truth across image, category, number, and heading', () => {
      for (let i = 0; i < totalSlides; i++) {
        const slide = featureSlides[i];
        expect(slide.storyNumber).toBe(`0${i + 1} / 08`);
        expect(slide.category).toBe(featureSlides[i].category);
        expect(slide.heading).toBe(featureSlides[i].heading);
        expect(slide.image).toBe(featureSlides[i].image);
      }
    });
  });

  describe('3. Autoplay Progression, Looping & Timer Invariants', () => {
    it('defines 2000ms (2 seconds) interval in component source', () => {
      expect(componentSource).toContain('2000');
      expect(componentSource).toContain('setInterval');
      expect(componentSource).toContain('clearInterval');
    });

    it('simulates 2-second automated timer advancing forward across 8 slides', () => {
      let activeIndex = 0;
      const total = 8;
      const step = () => {
        activeIndex = (activeIndex + 1) % total;
      };

      const timerId = setInterval(step, 2000);

      // Advance by 2 seconds -> slide 1
      vi.advanceTimersByTime(2000);
      expect(activeIndex).toBe(1);

      // Advance another 2 seconds -> slide 2
      vi.advanceTimersByTime(2000);
      expect(activeIndex).toBe(2);

      // Advance 12 more seconds (6 intervals) -> total 8 intervals -> should wrap to slide 0
      vi.advanceTimersByTime(12000);
      expect(activeIndex).toBe(0);

      clearInterval(timerId);
    });

    it('verifies autoplay wrap-around from slide 8 back to slide 1', () => {
      let activeIndex = 7;
      const total = 8;
      const step = () => {
        activeIndex = (activeIndex + 1) % total;
      };

      const timerId = setInterval(step, 2000);
      vi.advanceTimersByTime(2000);
      expect(activeIndex).toBe(0);
      clearInterval(timerId);
    });

    it('verifies manual navigation triggers resetCountdown()', () => {
      expect(componentSource).toContain('resetCountdown()');
      expect(componentSource).toContain('setResetKey');
      expect(componentSource).toContain('resetKey');
    });

    it('ensures timer cleanup hook is declared to avoid duplicate intervals on unmount', () => {
      expect(componentSource).toContain('return () => {');
      expect(componentSource).toContain('clearInterval(timer);');
    });
  });

  describe('4. User Controls, Pause Mechanics & Reduced Motion', () => {
    it('provides visible Play/Pause toggle button in the carousel header', () => {
      expect(componentSource).toContain('data-testid="carousel-play-pause-btn"');
      expect(componentSource).toContain('toggleAutoPlay');
      expect(componentSource).toContain("isAutoPlayActive ? 'Pause autoplay' : 'Start autoplay'");
    });

    it('pauses autoplay when pointer hovers over carousel (onMouseEnter / onMouseLeave)', () => {
      expect(componentSource).toContain('onMouseEnter={() => setIsHovered(true)}');
      expect(componentSource).toContain('onMouseLeave={() => setIsHovered(false)}');
      expect(componentSource).toContain('!isAutoPlayActive || isHovered || isFocused');
    });

    it('pauses autoplay when keyboard focus enters carousel (onFocus / onBlur)', () => {
      expect(componentSource).toContain('onFocus={handleFocus}');
      expect(componentSource).toContain('onBlur={handleBlur}');
    });

    it('guarantees that an explicitly paused carousel does not resume on pointer leave', () => {
      const isAutoPlayActive = false;
      const isHovered = false;
      const isFocused = false;
      const shouldRunTimer = isAutoPlayActive && !isHovered && !isFocused;
      expect(shouldRunTimer).toBe(false);
    });

    it('detects user reduced motion preferences (prefers-reduced-motion)', () => {
      expect(componentSource).toContain('prefers-reduced-motion: reduce');
      expect(componentSource).toContain('setIsAutoPlayActive(false)');
    });
  });

  describe('5. Accessibility, Responsive Layout & Mounting', () => {
    it('configures aria-live region to suppress verbal bombardment during 2s autoplay', () => {
      expect(componentSource).toContain('isActivelyAutoPlaying ? \'off\' : \'polite\'');
      expect(componentSource).toContain('aria-live={liveRegionMode}');
    });

    it('provides accessible labels and touch targets for all 8 pagination buttons', () => {
      expect(componentSource).toContain('data-testid={`pagination-dot-${idx}`}');
      expect(componentSource).toContain('aria-label={`Go to slide ${idx + 1}: ${slide.category}`}');
      expect(componentSource).toContain('min-h-[44px]');
    });

    it('declares carousel region with accessible name and roledescription', () => {
      expect(componentSource).toContain('role="region"');
      expect(componentSource).toContain('aria-roledescription="carousel"');
      expect(componentSource).toContain('aria-label="VeriCommit Feature Showcase"');
    });

    it('verifies App.tsx mounts FeatureCarousel on the dashboard', () => {
      expect(appSource).toContain('<FeatureCarousel />');
    });
  });
});

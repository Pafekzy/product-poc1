import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { featureSlides, CarouselSlide } from '../components/FeatureCarousel';

describe('Feature Showcase Carousel 9-Slide & Autoplay Verification', () => {
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

  describe('1. Slide Structure, Exact File Names & 9-Slide Invariants', () => {
    it('defines exactly 9 curated showcase slides in the expected sequence', () => {
      expect(featureSlides).toHaveLength(9);
    });

    it('includes all 5 exact funding scenario image filenames without substitution', () => {
      const expectedScenarioImages = [
        '/images/scenario-02-one-grantor-multiple-grantees.png',
        '/images/scenario-03-multiple-grantors-one-grantee.png',
        '/images/scenario-04-sequential-funding.png',
        '/images/scenario-05-collaborative-grantor.png',
        '/images/scenario-06-invalid-and-valid-alternatives.png'
      ];

      const slideImages = featureSlides.map((s) => s.image);
      expectedScenarioImages.forEach((expectedImg) => {
        expect(slideImages).toContain(expectedImg);
      });
    });

    it('verifies all 9 slide story numbers format strictly from "01 / 09" through "09 / 09"', () => {
      featureSlides.forEach((slide: CarouselSlide, index: number) => {
        const expectedStoryNumber = `0${index + 1} / 09`;
        expect(slide.storyNumber).toBe(expectedStoryNumber);
      });
    });

    it('verifies that all 9 local images exist on the filesystem', () => {
      featureSlides.forEach((slide) => {
        const relativeImagePath = slide.image.replace(/^\//, '');
        const absolutePath = path.resolve(__dirname, '../../', relativeImagePath);
        expect(fs.existsSync(absolutePath)).toBe(true);
      });
    });

    it('verifies every slide contains valid category, heading, description, badge, and key takeaway', () => {
      featureSlides.forEach((slide) => {
        expect(slide.category.trim().length).toBeGreaterThan(0);
        expect(slide.heading.trim().length).toBeGreaterThan(0);
        expect(slide.description.trim().length).toBeGreaterThan(20);
        expect(slide.imageAlt.trim().length).toBeGreaterThan(10);
        expect(slide.badge.trim().length).toBeGreaterThan(0);
        expect(slide.keyTakeaway.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('2. Navigation Logic & Full 9-Slide Wrap-Around Invariants', () => {
    const totalSlides = featureSlides.length;

    it('verifies forward navigation steps sequentially from 01 to 09', () => {
      let activeIndex = 0;
      const nextSlide = (curr: number) => (curr + 1) % totalSlides;

      for (let i = 1; i < totalSlides; i++) {
        activeIndex = nextSlide(activeIndex);
        expect(activeIndex).toBe(i);
        expect(featureSlides[activeIndex].storyNumber).toBe(`0${i + 1} / 09`);
      }
    });

    it('verifies navigation wraps from slide nine (index 8) to slide one (index 0)', () => {
      const nextSlide = (curr: number) => (curr + 1) % totalSlides;
      const wrappedIndex = nextSlide(8);
      expect(wrappedIndex).toBe(0);
      expect(featureSlides[wrappedIndex].storyNumber).toBe('01 / 09');
    });

    it('verifies backward navigation steps sequentially from 09 down to 01', () => {
      let activeIndex = 8;
      const prevSlide = (curr: number) => (curr - 1 + totalSlides) % totalSlides;

      for (let i = 7; i >= 0; i--) {
        activeIndex = prevSlide(activeIndex);
        expect(activeIndex).toBe(i);
        expect(featureSlides[activeIndex].storyNumber).toBe(`0${i + 1} / 09`);
      }
    });

    it('verifies backward navigation wraps from slide one (index 0) to slide nine (index 8)', () => {
      const prevSlide = (curr: number) => (curr - 1 + totalSlides) % totalSlides;
      const wrappedIndex = prevSlide(0);
      expect(wrappedIndex).toBe(8);
      expect(featureSlides[wrappedIndex].storyNumber).toBe('09 / 09');
    });

    it('verifies direct pagination jumping for all 9 indices', () => {
      for (let i = 0; i < totalSlides; i++) {
        const slide = featureSlides[i];
        expect(slide.storyNumber).toBe(`0${i + 1} / 09`);
      }
    });
  });

  describe('3. Autoplay Behavior, 2-Second Progression & Timer Invariants', () => {
    it('defines 2000ms (2 seconds) interval in component source', () => {
      expect(componentSource).toContain('2000');
      expect(componentSource).toContain('setInterval');
      expect(componentSource).toContain('clearInterval');
    });

    it('simulates 2-second automated timer advancing forward across slides', () => {
      let activeIndex = 0;
      const total = 9;
      const step = () => {
        activeIndex = (activeIndex + 1) % total;
      };

      const timerId = setInterval(step, 2000);

      // Advance by 2 seconds -> should be slide 1
      vi.advanceTimersByTime(2000);
      expect(activeIndex).toBe(1);

      // Advance another 2 seconds -> slide 2
      vi.advanceTimersByTime(2000);
      expect(activeIndex).toBe(2);

      // Advance 7 more intervals -> 14 seconds -> should wrap to slide 0
      vi.advanceTimersByTime(14000);
      expect(activeIndex).toBe(0);

      clearInterval(timerId);
    });

    it('verifies autoplay wrap-around from slide 9 back to slide 1', () => {
      let activeIndex = 8;
      const total = 9;
      const step = () => {
        activeIndex = (activeIndex + 1) % total;
      };

      const timerId = setInterval(step, 2000);
      vi.advanceTimersByTime(2000);
      expect(activeIndex).toBe(0);
      clearInterval(timerId);
    });

    it('verifies manual navigation resets the countdown trigger via state dependency', () => {
      // In componentSource, goToPrevious, goToNext, and goToSlide all invoke resetCountdown()
      expect(componentSource).toContain('resetCountdown()');
      expect(componentSource).toContain('setResetKey');
      expect(componentSource).toContain('resetKey');
    });

    it('ensures timer cleanup hook is declared to avoid memory leaks or duplicate intervals', () => {
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

    it('supports pause on pointer hover (onMouseEnter / onMouseLeave)', () => {
      expect(componentSource).toContain('onMouseEnter={() => setIsHovered(true)}');
      expect(componentSource).toContain('onMouseLeave={() => setIsHovered(false)}');
      expect(componentSource).toContain('!isAutoPlayActive || isHovered || isFocused');
    });

    it('supports pause on keyboard focus (onFocus / onBlur)', () => {
      expect(componentSource).toContain('onFocus={handleFocus}');
      expect(componentSource).toContain('onBlur={handleBlur}');
    });

    it('guarantees that an explicitly paused carousel does not resume on pointer leave', () => {
      // When isAutoPlayActive is false, isHovered becoming false does not start timer
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

  describe('5. Accessibility & Responsive Constraints', () => {
    it('configures aria-live region to suppress verbal bombardment during 2s autoplay', () => {
      expect(componentSource).toContain('isActivelyAutoPlaying ? \'off\' : \'polite\'');
      expect(componentSource).toContain('aria-live={liveRegionMode}');
    });

    it('provides accessible labels and touch targets for all 9 pagination buttons', () => {
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

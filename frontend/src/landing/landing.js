import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './landing.css'

gsap.registerPlugin(ScrollTrigger)

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Split the scrub paragraph into word spans regardless of motion preference;
// reduced motion shows them at full opacity via CSS.
const scrubText = document.querySelector('[data-scrub]')
if (scrubText) {
  const words = scrubText.textContent.trim().split(/\s+/)
  scrubText.innerHTML = words
    .map((word) => `<span class="lp-word">${word}</span>`)
    .join(' ')
}

if (!reduceMotion) {
  // Hero entrance: rise + fade, staggered. Content is visible by default;
  // gsap.from means a failed script still leaves a complete hero.
  gsap.from('[data-hero-rise]', {
    opacity: 0,
    y: 24,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.15,
  })

  gsap.from('.lp-hero-bg', {
    scale: 1.06,
    duration: 1.6,
    ease: 'power2.out',
  })

  // Paradigm 1 — pinned split: the title holds while the gallery scrolls.
  ScrollTrigger.matchMedia({
    '(min-width: 901px)': () => {
      ScrollTrigger.create({
        trigger: '.lp-split',
        pin: '.lp-split-pin',
        start: 'top 18%',
        end: 'bottom 75%',
        pinSpacing: false,
      })
    },
  })

  // Gallery panels rise in as they enter.
  gsap.utils.toArray('.lp-panel').forEach((panel) => {
    gsap.from(panel, {
      opacity: 0,
      y: 48,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: panel,
        start: 'top 85%',
      },
    })
  })

  // Paradigm 2 — scrubbing text reveal: words sequence from 0.12 to 1.
  if (scrubText) {
    gsap.to('.lp-word', {
      opacity: 1,
      stagger: 0.06,
      ease: 'none',
      scrollTrigger: {
        trigger: '.lp-scrub',
        start: 'top 75%',
        end: 'center 45%',
        scrub: true,
      },
    })
  }

  // Bento cards settle in with a slight cascade.
  gsap.from('.lp-card', {
    opacity: 0,
    y: 32,
    duration: 0.7,
    ease: 'power3.out',
    stagger: 0.08,
    scrollTrigger: {
      trigger: '.lp-bento',
      start: 'top 80%',
    },
  })

  // Closing CTA grows into place.
  gsap.from('.lp-action-title', {
    opacity: 0,
    scale: 0.94,
    duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.lp-action',
      start: 'top 75%',
    },
  })
}

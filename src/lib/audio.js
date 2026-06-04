// src/lib/audio.js — split from src/lib/shared.js (SPA-split follow-up #1).

const { useEffect, useState } = React;

let _audioCtx = null;

export function primeAudioCtx() {
      if (!_audioCtx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          _audioCtx = new AC();
        } catch (_) { return null; }
      }
      if (_audioCtx.state === "suspended") {
        _audioCtx.resume().catch(() => {});
      }
      return _audioCtx;
    }

export function playRestCue(kind) {
      const ctx = primeAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const now = ctx.currentTime;
      if (kind === "go") {
        osc.frequency.value = 1320;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.60);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.60);
      } else {
        // Short beep at T-3/T-2/T-1
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      }
    }

export function useIsLandscape() {
      const [land, setLand] = useState(() => window.innerWidth > window.innerHeight);
      useEffect(() => {
        const update = () => setLand(window.innerWidth > window.innerHeight);
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", update);
        return () => {
          window.removeEventListener("resize", update);
          window.removeEventListener("orientationchange", update);
        };
      }, []);
      return land;
    }

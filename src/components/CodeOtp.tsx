"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ClipboardEvent, ChangeEvent, KeyboardEvent, CSSProperties } from "react";
import styles from "./CodeOtp.module.css";

export type CodeOtpProps = {
  longueur?: 4 | 6;
  verifier: (code: string) => Promise<boolean>;
  onSucces?: () => void;
  onEchec?: () => void;
  titre?: string;
  description?: string;
  disabled?: boolean;
};

type Phase = "saisie" | "orbite" | "attente" | "succes" | "echec";
type Particle = { id: number; x: number; y: number; delay: number; size: number; green: boolean };

export function CodeOtp({
  longueur = 6,
  verifier,
  onSucces,
  onEchec,
  titre = "Saisissez votre code",
  description = "Entrez le code reçu pour continuer.",
  disabled = false,
}: CodeOtpProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const liveId = `${id}-live`;
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("saisie");
  const [popIndex, setPopIndex] = useState(-1);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [annonce, setAnnonce] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const waitResolversRef = useRef<Array<() => void>>([]);
  const mountedRef = useRef(true);
  const phaseRef = useRef<Phase>("saisie");
  const codeRef = useRef("");
  const verifyRef = useRef(verifier);
  const successRef = useRef(onSucces);
  const failureRef = useRef(onEchec);

  verifyRef.current = verifier;
  successRef.current = onSucces;
  failureRef.current = onEchec;
  phaseRef.current = phase;
  codeRef.current = code;

  const schedule = useCallback((callback: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter(item => item !== timer);
      if (mountedRef.current) callback();
    }, ms);
    timersRef.current.push(timer);
    return timer;
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    waitResolversRef.current.splice(0).forEach(resolve => resolve());
  }, []);

  const waitFor = useCallback((ms: number) => new Promise<void>(resolve => {
    const finish = () => {
      timersRef.current = timersRef.current.filter(item => item !== timer);
      waitResolversRef.current = waitResolversRef.current.filter(item => item !== finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ms);
    timersRef.current.push(timer);
    waitResolversRef.current.push(finish);
  }), []);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!reducedMotion && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(pattern); } catch { /* Vibration is optional. */ }
    }
  }, [reducedMotion]);

  const makeParticles = useCallback(() => {
    if (reducedMotion) return;
    setParticles(Array.from({ length: 12 }, (_, index) => ({
      id: index,
      x: Math.round(Math.cos(index * Math.PI / 6) * (34 + (index % 3) * 8)),
      y: Math.round(Math.sin(index * Math.PI / 6) * (34 + (index % 3) * 8)),
      delay: (index % 4) * 45,
      size: 3 + (index % 3),
      green: index % 3 === 0,
    })));
  }, [reducedMotion]);

  const reset = useCallback((focus = true) => {
    attemptRef.current += 1;
    clearTimers();
    setCode("");
    codeRef.current = "";
    setPhase("saisie");
    phaseRef.current = "saisie";
    setPopIndex(-1);
    setParticles([]);
    setAnnonce("");
    if (focus) schedule(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [clearTimers, schedule]);

  const verify = useCallback(async (value: string) => {
    const attempt = ++attemptRef.current;
    clearTimers();
    setPhase("orbite");
    phaseRef.current = "orbite";
    setAnnonce("Vérification en cours");
    makeParticles();
    const reduced = reducedMotion;
    if (!reduced) vibrate(10);

    let result: boolean | undefined;
    const response = Promise.resolve()
      .then(() => verifyRef.current(value))
      .then(value => { result = value === true; return result; })
      .catch(() => { result = false; return false; });

    if (!reduced) {
      await waitFor(900);
      if (!mountedRef.current || attemptRef.current !== attempt) return;
      if (result === undefined) {
        setPhase("attente");
        phaseRef.current = "attente";
      }
    }
    const success = await response;
    if (!mountedRef.current || attemptRef.current !== attempt) return;
    setParticles([]);
    if (success) {
      setPhase("succes");
      phaseRef.current = "succes";
      setAnnonce("Code vérifié");
      if (!reduced) vibrate([20, 40, 20]);
      schedule(() => {
        if (attemptRef.current === attempt) successRef.current?.();
      }, 900);
    } else {
      setPhase("echec");
      phaseRef.current = "echec";
      setAnnonce("Code incorrect");
      schedule(() => {
        if (attemptRef.current !== attempt) return;
        setCode("");
        codeRef.current = "";
        setPhase("saisie");
        phaseRef.current = "saisie";
        setPopIndex(-1);
        setAnnonce("Code incorrect, réessayez");
        inputRef.current?.focus({ preventScroll: true });
        failureRef.current?.();
      }, reduced ? 0 : 600);
    }
  }, [clearTimers, makeParticles, reducedMotion, schedule, vibrate, waitFor]);

  const applyDigit = useCallback((next: string, animate = true) => {
    const digits = next.replace(/\D/g, "").slice(0, longueur);
    setCode(digits);
    codeRef.current = digits;
    if (animate && digits.length > codeRef.current.length) setPopIndex(digits.length - 1);
    if (digits.length > 0) {
      setPopIndex(digits.length - 1);
      if (animate && !reducedMotion) vibrate(10);
    } else {
      setPopIndex(-1);
    }
    if (digits.length === longueur) void verify(digits);
  }, [longueur, reducedMotion, verify, vibrate]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (phaseRef.current !== "saisie" || disabled) return;
    const raw = event.currentTarget.value;
    const digits = raw.replace(/\D/g, "").slice(0, longueur);
    if (digits.length > 1 && digits.length > codeRef.current.length) {
      clearTimers();
      setCode("");
      codeRef.current = "";
      setPopIndex(-1);
      [...digits].forEach((digit, index) => {
        schedule(() => {
          if (phaseRef.current !== "saisie") return;
          const current = codeRef.current;
          const next = (current + digit).slice(0, longueur);
          setCode(next);
          codeRef.current = next;
          setPopIndex(index);
          if (!reducedMotion) vibrate(10);
          if (next.length === longueur) void verify(next);
        }, index * 40);
      });
      event.currentTarget.value = digits;
      return;
    }
    applyDigit(digits);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (phaseRef.current !== "saisie" || disabled) return;
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, longueur);
    if (!digits) return;
    event.preventDefault();
    clearTimers();
    setCode("");
    codeRef.current = "";
    setPopIndex(-1);
    [...digits].forEach((digit, index) => {
      schedule(() => {
        if (phaseRef.current !== "saisie") return;
        const next = (codeRef.current + digit).slice(0, longueur);
        setCode(next);
        codeRef.current = next;
        setPopIndex(index);
        if (!reducedMotion) vibrate(10);
        if (next.length === longueur) void verify(next);
      }, index * 40);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && (phaseRef.current === "orbite" || phaseRef.current === "attente")) {
      event.preventDefault();
      reset();
      return;
    }
    if (event.key === "Backspace" && (phaseRef.current === "orbite" || phaseRef.current === "attente")) {
      event.preventDefault();
      reset(false);
      return;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener?.("change", updateMotion);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clearTimers();
        setParticles([]);
        if (phaseRef.current === "orbite" || phaseRef.current === "attente") {
          attemptRef.current += 1;
          setPhase("saisie");
          phaseRef.current = "saisie";
          setCode("");
          codeRef.current = "";
          setPopIndex(-1);
          setAnnonce("");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      clearTimers();
      media.removeEventListener?.("change", updateMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clearTimers]);

  const inMotion = phase === "orbite" || phase === "attente";
  const isSuccess = phase === "succes";
  const isFailure = phase === "echec";

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <h2 id={`${id}-title`} className={`${styles.title} ${isSuccess ? styles.titleSuccess : ""}`}>{isSuccess ? "Code vérifié" : titre}</h2>
        <p className={styles.description}>{isSuccess ? "Vous pouvez continuer." : description}</p>
      </div>
      <div className={styles.stage} data-phase={phase} data-length={longueur} data-reduced={reducedMotion ? "true" : "false"}>
        <input
          ref={inputRef}
          className={styles.realInput}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={longueur}
          value={code}
          disabled={disabled || isSuccess}
          onChange={onChange}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          aria-label={`Code de vérification, ${longueur} chiffres`}
          aria-describedby={`${descriptionId} ${liveId}`}
          onClick={() => { if (phaseRef.current === "saisie") inputRef.current?.focus(); }}
        />
        <div className={styles.orbitRing} aria-hidden="true" />
        <div className={styles.orbitTrail} aria-hidden="true" />
        <div className={styles.cells}>
          {Array.from({ length: longueur }, (_, index) => (
            <div
              key={index}
              role="img"
              aria-label={`Chiffre ${index + 1} sur ${longueur}${code[index] ? `: ${code[index]}` : ", vide"}`}
              className={`${styles.cell} ${index === code.length && phase === "saisie" ? styles.active : ""} ${index === popIndex ? styles.pop : ""} ${isFailure ? styles.invalid : ""} ${isSuccess ? styles.successCell : ""}`}
              style={{ "--index": index, "--count": longueur, "--pop-delay": "0ms" } as CSSProperties}
            >
              {isSuccess ? (index === 0 ? <svg className={styles.check} viewBox="0 0 48 48"><path d="M10 25 L20 34 L38 14" /></svg> : null) : code[index] ?? ""}
            </div>
          ))}
        </div>
        {particles.length > 0 && !reducedMotion && <div className={styles.particles} aria-hidden="true">
          {particles.map(particle => <span key={particle.id} className={`${styles.particle} ${particle.green ? styles.greenParticle : ""}`} style={{ "--x": `${particle.x}px`, "--y": `${particle.y}px`, "--delay": `${particle.delay}ms`, "--size": `${particle.size}px` } as React.CSSProperties} />)}
        </div>}
        {isSuccess && !reducedMotion && <div className={styles.waves} aria-hidden="true"><span /><span /><span /></div>}
        {isSuccess && !reducedMotion && <div className={styles.sparkles} aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
      </div>
      <p id={descriptionId} className={styles.hint}>{isFailure ? "Code incorrect, réessayez" : isSuccess ? "Vérification terminée" : description}</p>
      <p id={liveId} className={styles.srOnly} aria-live="polite" aria-atomic="true">{annonce}</p>
      {phase === "saisie" && !disabled && <button type="button" className={styles.resetButton} onClick={() => { reset(); }} aria-label="Effacer le code">Effacer</button>}
    </section>
  );
}

export default CodeOtp;

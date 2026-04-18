import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { io } from 'socket.io-client';
import AppLayout from '../components/AppLayout';
import { getQuizHint, getQuizQuestions, getQuizResult, getQuizSlot, postQuizBet } from '../api/quizApi';
import { getQuizSocketUrl } from '../config/api';
import { verifyFairness } from '../utils/quizFairness';
import { getVisibleQuestionCountFromSlotStart, QUESTION_REVEAL_STAGGER_MS, STUDY_MINUTES } from '../utils/quizSlotClock';
const QUIZ_MODE = '2d';

const pad2 = (n) => String(n).padStart(2, '0');

const btnInactive = 'bg-[#5c2222] text-white border-2 border-[#3d1515] shadow-inner';
const btnActive = 'bg-[#f5e14a] text-black border-2 border-[#c9b429] shadow-sm';

const formatCountdown = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const cleanQuestionText = (text) =>
  String(text || '').replace(/^(?:प्रश्न|Question)\s*\(\d{1,2}-\d{2}\)\s*:\s*/iu, '');

const LotteryQuizPage = () => {
  const navigate = useNavigate();
  const BASE_WIDTH = 1536;
  const BASE_HEIGHT = 864;
  const [selectedQuiz, setSelectedQuiz] = useState(1);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : BASE_HEIGHT,
  }));
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [slotData, setSlotData] = useState(null);
  const [slotErr, setSlotErr] = useState('');
  const [questions, setQuestions] = useState([]);
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(0);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsErr, setQuestionsErr] = useState('');
  const [answerRevealed, setAnswerRevealed] = useState({});
  const [hintData, setHintData] = useState(null);
  const [betLines, setBetLines] = useState([{ number: '', amount: '' }]);
  const [guessFeedback, setGuessFeedback] = useState(null);
  const [fairnessResult, setFairnessResult] = useState(null);
  const [fairnessCheck, setFairnessCheck] = useState(null);

  const lastBetNumbersRef = useRef([]);
  const selectedQuizRef = useRef(selectedQuiz);
  const lastHintSlotRef = useRef(null);
  const lastLandscapeAutoFsAttemptRef = useRef(0);

  const quizLabel = `QUIZ${pad2(selectedQuiz)}`;
  const dashboardScaleX = useMemo(() => viewport.width / BASE_WIDTH, [viewport.width]);
  const dashboardScaleY = useMemo(() => viewport.height / BASE_HEIGHT, [viewport.height]);

  useEffect(() => {
    selectedQuizRef.current = selectedQuiz;
  }, [selectedQuiz]);

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const checkMobilePortrait = () => {
      const isMobile = window.innerWidth <= 900;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowRotatePrompt(isMobile && isPortrait);

      if (isMobile && !isPortrait && !document.fullscreenElement) {
        const nowMs = Date.now();
        if (nowMs - lastLandscapeAutoFsAttemptRef.current > 1200) {
          lastLandscapeAutoFsAttemptRef.current = nowMs;
          const root = document.documentElement;
          if (root.requestFullscreen) {
            root.requestFullscreen().catch(() => {
              // Some browsers require explicit user action.
            });
          }
        }
      }
    };
    checkMobilePortrait();
    window.addEventListener('resize', checkMobilePortrait);
    window.addEventListener('orientationchange', checkMobilePortrait);
    return () => {
      window.removeEventListener('resize', checkMobilePortrait);
      window.removeEventListener('orientationchange', checkMobilePortrait);
    };
  }, []);

  useEffect(() => {
    if (hintData?.slotStartIso) {
      lastHintSlotRef.current = hintData.slotStartIso;
    }
  }, [hintData?.slotStartIso]);

  useEffect(() => {
    const url = getQuizSocketUrl();
    if (!url) return undefined;

    const socket = io(url, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    const onQuizResult = async (data) => {
      if (!data?.slotStartIso || !Array.isArray(data.results)) return;
      if (String(data?.gameMode || '2d').toLowerCase() !== QUIZ_MODE) return;
      const targetSlot = lastHintSlotRef.current;
      if (!targetSlot || data.slotStartIso !== targetSlot) return;

      const qid = selectedQuizRef.current;
      const row = data.results.find((r) => r.quizId === qid);
      if (!row || row.result == null) return;

      const idx = String(row.result).padStart(2, '0');

      try {
          const j = await getQuizResult(qid, data.slotStartIso, QUIZ_MODE);
        if (j.success && j.data) {
          setFairnessResult({
            quizId: qid,
            seed: j.data?.seed,
            seedHash: j.data?.seedHash,
            questionIndex: j.data?.questionIndex ?? idx,
          });
          setFairnessCheck(null);
        }
      } catch {
        /* fairness payload optional */
      }

      const nums = lastBetNumbersRef.current;
      const hit = nums.some((n) => String(n).padStart(2, '0') === idx);
      if (nums.length) {
        setGuessFeedback(hit ? `Correct - one or more bets won - winning number ${idx}` : `Wrong - winning number ${idx}`);
      } else {
        setGuessFeedback(`Winning number: ${idx}`);
      }
    };

    socket.on('quiz:result', onQuizResult);
    return () => {
      socket.off('quiz:result', onQuizResult);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const j = await getQuizSlot();
        if (!stop && j.success) setSlotData(j.data);
        if (!stop) setSlotErr('');
      } catch (e) {
        if (!stop) setSlotErr(e.message || 'Slot sync failed');
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!slotData || slotData.phase !== 'study') {
      setQuestionsLoading(false);
      setQuestionsErr('');
      return undefined;
    }
    let cancelled = false;
    setQuestions([]);
    setQuestionsLoading(true);
    setQuestionsErr('');
    getQuizQuestions(selectedQuiz, QUIZ_MODE)
      .then((j) => {
        if (!cancelled && j.success && Array.isArray(j.data?.questions)) {
          setQuestions(j.data.questions);
        }
      })
      .catch((e) => {
        if (!cancelled) setQuestionsErr(e.message || 'Failed to load questions');
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedQuiz, slotData?.phase, slotData?.slotStartIso]);

  useLayoutEffect(() => {
    if (!questions.length || !slotData?.slotStartIso) {
      setVisibleQuestionCount(0);
      return undefined;
    }
    const tick = () => {
      setVisibleQuestionCount(
        getVisibleQuestionCountFromSlotStart(slotData.slotStartIso, questions.length, QUESTION_REVEAL_STAGGER_MS),
      );
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [questions, slotData?.slotStartIso]);

  useEffect(() => {
    setAnswerRevealed({});
  }, [questions]);

  useEffect(() => {
    if (slotData?.phase !== 'hint') {
      setHintData(null);
      return undefined;
    }
    setHintData(null);
    let cancelled = false;
    const load = async () => {
      try {
        const j = await getQuizHint(selectedQuiz, QUIZ_MODE);
        if (!cancelled && j.success) {
          setHintData({
            quizId: selectedQuiz,
            questionText: j.data.questionText,
            slotStartIso: j.data.slotStartIso,
            seedHash: j.data.seedHash,
          });
        }
      } catch {
        /* NOT_HINT_PHASE during race — retry on interval */
      }
    };
    load();
    const id = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slotData?.phase, selectedQuiz]);

  useEffect(() => {
    setBetLines([{ number: '', amount: '' }]);
    lastBetNumbersRef.current = [];
    setGuessFeedback(null);
    setFairnessResult(null);
    setFairnessCheck(null);
  }, [slotData?.phase, slotData?.slotStartIso, selectedQuiz]);

  const toggleAnswer = useCallback((rowId) => {
    setAnswerRevealed((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }, []);

  const goToBoard = useCallback(() => {
    navigate(`/lottery?quiz=${selectedQuiz}`);
  }, [navigate, selectedQuiz]);

  const submitQuizBets = useCallback(async () => {
    const slotStartIso = slotData?.slotStartIso;
    const canBet =
      slotStartIso &&
      (slotData?.acceptsBets === true ||
        (slotData?.acceptsBets !== false && slotData?.phase === 'hint'));
    if (!canBet) {
      setGuessFeedback('Current draw slot is closed or loading. Please wait.');
      return;
    }

    const parsed = [];
    for (const row of betLines) {
      const nRaw = String(row.number ?? '').replace(/\D/g, '').slice(0, 2);
      const amt = Number(String(row.amount ?? '').replace(/[^\d.]/g, ''));
      if (!nRaw && !row.amount) continue;
      if (nRaw.length !== 2) {
        setGuessFeedback('For each line, enter a 2-digit number (00-99) or remove empty rows.');
        return;
      }
      const num = parseInt(nRaw, 10);
      if (num < 0 || num > 99 || !Number.isFinite(amt) || amt < 1) {
        setGuessFeedback('Each bet must have number 00-99 and minimum amount 1.');
        return;
      }
      parsed.push({ number: num, amount: Math.floor(amt) });
    }

    if (parsed.length === 0) {
      setGuessFeedback('Enter at least one bet (number + amount).');
      return;
    }
    if (parsed.length > 100) {
      setGuessFeedback('Maximum 100 unique numbers allowed at a time.');
      return;
    }

    const seen = new Set();
    for (const p of parsed) {
      if (seen.has(p.number)) {
        setGuessFeedback('Duplicate numbers are not allowed in the same slot.');
        return;
      }
      seen.add(p.number);
    }

    try {
      const j = await postQuizBet(selectedQuiz, parsed, QUIZ_MODE);
      if (j.success && j.data?.bets) {
        lastBetNumbersRef.current = j.data.bets.map((b) => b.number);
      }
    } catch (e) {
      if (e.status === 401) {
        setGuessFeedback('Please login to place bets (JWT / user token).');
        return;
      }
      if (e.status === 403) {
        setGuessFeedback(e.message || 'Bets are not accepted for this slot.');
        return;
      }
      if (e.status === 409) {
        setGuessFeedback(e.message || 'Could not submit bet. Please try again.');
        return;
      }
      setGuessFeedback(e.message || 'Bet submission failed.');
      return;
    }

    try {
      const j = await getQuizResult(selectedQuiz, slotStartIso, QUIZ_MODE);
      const correct = j.data?.questionIndex;
      setFairnessResult({
        quizId: selectedQuiz,
        seed: j.data?.seed,
        seedHash: j.data?.seedHash,
        questionIndex: correct,
      });
      setFairnessCheck(null);
      const idx = correct;
      const hit = parsed.some((p) => String(p.number).padStart(2, '0') === idx);
      if (idx != null) {
        setGuessFeedback(
          hit ? `Bet submitted. Correct number ${idx} (winnings credited after slot closes).` : `Bet submitted. Winning number ${idx}.`,
        );
      } else {
        setGuessFeedback('Bet submitted. Result will be shown after slot ends.');
      }
    } catch (e) {
      if (e.status === 403 && e.code === 'SLOT_NOT_ENDED') {
        setGuessFeedback('Bet submitted. Result and fairness (seed) will appear after slot ends.');
      } else if (e.status === 403) {
        setGuessFeedback('Bet submitted. Check the result later.');
      } else {
        setGuessFeedback(e.message || 'Verification failed.');
      }
    }
  }, [betLines, slotData, selectedQuiz]);

  const runFairnessVerify = useCallback(async () => {
    if (!fairnessResult?.seed || !fairnessResult?.seedHash) {
      setFairnessCheck('Seed not available in result payload.');
      return;
    }
    try {
      const ok = await verifyFairness(fairnessResult.seed, fairnessResult.seedHash);
      setFairnessCheck(ok ? '✓ hash(seed) matches hint seedHash - provably fair.' : '✗ Mismatch detected - please check.');
    } catch (err) {
      setFairnessCheck(err.message || 'Verify failed');
    }
  }, [fairnessResult]);

  const hintPhase = slotData?.phase === 'hint';
  const studyPhase = slotData?.phase === 'study';
  const slotOpenForBuy = useMemo(() => {
    if (!slotData?.slotStartIso) return false;
    if (slotData.acceptsBets === true) return true;
    if (slotData.acceptsBets === false) return false;
    return slotData.phase === 'hint';
  }, [slotData]);

  const handleRotateLandscape = useCallback(async () => {
    try {
      const root = document.documentElement;
      if (root.requestFullscreen && !document.fullscreenElement) {
        await root.requestFullscreen();
      }
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('landscape');
      }
    } catch (_) {
      // On many mobile browsers this requires user/system support.
    }
  }, []);

  return (
    <AppLayout>
      <div className="relative w-full min-h-screen min-h-[100dvh] overflow-hidden rounded-[14px] bg-[#111] sm:rounded-none">
        <div className="pointer-events-none absolute inset-0 rounded-[14px] border border-[#4c4c4c] sm:rounded-none" />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
          }}
        >
          <div
            className="absolute top-0 left-0 flex flex-col overflow-hidden border border-[#4c4c4c] bg-[#efe6d5] text-black"
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              transform: `scale(${dashboardScaleX}, ${dashboardScaleY})`,
              transformOrigin: 'top left',
            }}
          >
            <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-[#efe6d5]/95 px-2 pt-4 pb-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => navigate('/lottery')}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-base font-extrabold ${btnInactive}`}
          >
            <ArrowLeft size={18} strokeWidth={2.75} />
            2D
          </button>
          <span className="text-[15px] font-extrabold leading-snug text-[#5c2222] sm:text-lg">
            {slotErr
              ? `Server: ${slotErr}`
              : hintPhase
                ? `Hint phase - Draw: ${slotData?.drawLabelCurrent ?? ''} (${formatCountdown(slotData?.secondsUntilSlotEnd ?? 0)})`
                : `Hint in ${STUDY_MINUTES} min (${formatCountdown(slotData?.secondsUntilHint ?? 0)})`}
          </span>
              </div>

              <div className="flex flex-1 flex-col px-2 pb-24 sm:px-4">
          <div className="sticky z-[9] -mx-2 mb-3 bg-[#efe6d5]/95 px-2 pt-1 pb-2 backdrop-blur-sm sm:mx-0 sm:px-0" style={{ top: '52px' }}>
            <div className="mb-3 flex justify-center gap-2 sm:gap-3">
              <div className={`rounded-xl px-4 py-2.5 text-sm font-bold sm:px-6 sm:py-3 sm:text-base ${btnInactive} opacity-90`}>
                {slotData?.drawLabelPrev ?? '—'}
              </div>
              <div className={`rounded-xl px-4 py-2.5 text-sm font-bold sm:px-6 sm:py-3 sm:text-base ${btnActive}`}>
                {slotData?.drawLabelCurrent ?? '—'}
              </div>
              <div className={`rounded-xl px-4 py-2.5 text-sm font-bold sm:px-6 sm:py-3 sm:text-base ${btnInactive} opacity-90`}>
                {slotData?.drawLabelNext ?? '—'}
              </div>
            </div>

            {(studyPhase || hintPhase) && slotData && (
              <div className="w-full">
                <p className="mb-1.5 text-center text-[11px] font-semibold text-[#5c2222] sm:text-xs">
                  {hintPhase
                    ? 'Each quiz gets a unique question and result per slot. Select Q-01...Q-30 below to view hint.'
                    : 'Study: Select a quiz below - 100 questions each.'}
                </p>
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedQuiz(n)}
                      className={`rounded-md py-3 text-center text-[13px] font-bold sm:py-3.5 sm:text-[15px] ${
                        selectedQuiz === n ? btnActive : btnInactive
                      }`}
                    >
                      Q-{pad2(n)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {studyPhase && (
            <div
              className="w-full overflow-x-auto rounded-sm border border-[#8b7355] shadow-md select-none"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              {questionsLoading && <p className="p-4 text-center text-sm">Loading questions...</p>}
              {questionsErr && <p className="p-4 text-center text-sm text-red-700">{questionsErr}</p>}
              {!questionsLoading && !questionsErr && (
                <table className="w-full min-w-[640px] border-collapse text-left text-[13px] sm:text-[15px]">
                  <thead>
                    <tr className="bg-[#ff9a3c] text-black">
                      <th className="border border-[#c96d20] px-1 py-3 text-center font-bold sm:px-2 sm:py-3.5">{quizLabel}</th>
                      <th className="border border-[#c96d20] px-1 py-3 text-center font-bold sm:px-2 sm:py-3.5">QUESTION</th>
                      <th className="border border-[#c96d20] px-1 py-3 text-center font-bold sm:px-2 sm:py-3.5">OPTIONS</th>
                      <th className="w-[72px] border border-[#c96d20] px-1 py-3 text-center font-bold sm:w-[88px] sm:py-3.5">ANS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.slice(0, visibleQuestionCount).map((row, position) => (
                      <tr key={row.id}>
                        <td
                          className="align-top border border-[#7a9e5c] px-3 py-5 font-semibold leading-snug"
                          style={{ backgroundColor: '#b8e6a8' }}
                        >
                          <div className="text-[14px] font-bold sm:text-[16px]">Question No. {pad2(position)}</div>
                          <div className="mt-1 text-[13px] font-semibold opacity-95 sm:text-[14px]">{slotData?.drawLabelCurrent ?? ''}</div>
                        </td>
                        <td
                          className="align-top border border-[#e0a0b0] px-3 py-5 leading-snug"
                          style={{ backgroundColor: '#fcd4dc' }}
                        >
                          <span className="text-[16px] font-extrabold sm:text-[18px]">{cleanQuestionText(row.question)}</span>
                        </td>
                        <td
                          className="align-top border border-[#7eb8d4] px-3 py-5"
                          style={{ backgroundColor: '#cfe9f6' }}
                        >
                          <div className="grid grid-cols-2 gap-2 gap-x-3 text-[14px] font-semibold sm:text-[16px]">
                            {(['A', 'B', 'C', 'D']).map((k) => (
                              <div key={k} className="leading-snug">
                                <span className="font-bold">{k}:</span> {row.options[k]}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td
                          className="align-middle border border-[#0f3558] p-1 text-center"
                          style={{ backgroundColor: '#1a4a7a' }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleAnswer(row.id)}
                            className="w-full min-h-[72px] rounded border border-white/30 bg-white/10 px-2 py-4 text-sm font-bold text-white hover:bg-white/20 sm:text-base"
                          >
                            {answerRevealed[row.id] ? (
                              <span className="text-xl tracking-widest sm:text-2xl">{row.answer}</span>
                            ) : (
                              'HIDE'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {slotOpenForBuy && (
            <div className="mx-auto w-full max-w-[1100px] flex-1 rounded-sm border border-[#8b7355] bg-[#f5f0e6] shadow-md">
              {hintPhase && hintData && hintData.quizId === selectedQuiz ? (
                <div className="flex flex-col gap-0 sm:flex-row">
                  <div
                    className="flex w-full shrink-0 items-center justify-center border-b border-[#8b7355] px-3 py-6 text-lg font-bold text-[#1a6b2e] sm:w-[88px] sm:border-b-0 sm:border-r"
                    style={{ backgroundColor: '#e8f5e9' }}
                  >
                    Hint
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="border-b border-[#dcb] px-3 py-2 text-sm leading-snug" style={{ backgroundColor: '#fcd4dc' }}>
                      <p className="mb-2 font-medium text-[#4a1515]">
                        इस प्रश्न का उत्तर इस प्रश्न का क्रमांक है
                      </p>
                      <p className="text-[14px] font-semibold text-black">{hintData.questionText}</p>
                    </div>
                    {hintData.seedHash && (
                      <div className="border-b border-[#dcb] bg-[#f0f4ff] px-3 py-2 text-[11px] leading-snug text-[#1a2a5c]">
                        <span className="font-bold">Fairness hash (commitment):</span>
                        <p className="mt-1 break-all font-mono text-[10px] sm:text-[11px]">{hintData.seedHash}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {guessFeedback && (
                <div className="border-t border-[#8b7355] bg-[#efe6d5] px-3 py-2">
                  <p className="text-sm font-semibold text-[#3d1515]">{guessFeedback}</p>
                </div>
              )}
            </div>
          )}

          {hintPhase && slotOpenForBuy && (!hintData || hintData.quizId !== selectedQuiz) && (
            <div className="mx-auto py-6 text-center text-sm text-[#5c2222]">
              Loading hint for QUIZ{pad2(selectedQuiz)}...
            </div>
          )}

          {fairnessResult?.seed && (
            <div className="mx-auto mt-3 w-full max-w-[1100px] rounded-sm border border-[#7a9e5c] bg-[#eef8f0] px-3 py-3 text-sm shadow-sm">
              <p className="mb-1 font-bold text-[#1a4d2e]">
                Fairness (after slot closes)
                {fairnessResult.quizId != null && (
                  <span className="ml-1 font-mono text-[#0f3558]">· QUIZ{pad2(fairnessResult.quizId)}</span>
                )}
              </p>
              <p className="mb-1 text-xs text-[#333]">
                Winning number: <span className="font-mono font-bold">{fairnessResult.questionIndex}</span>
              </p>
              <p className="mb-0.5 text-xs font-semibold text-[#333]">Revealed seed (sha256(quizId+slotStart) hex):</p>
              <textarea
                readOnly
                className="mb-2 mt-1 w-full resize-none rounded border border-[#7a9e5c] bg-white p-1 font-mono text-[10px] text-black"
                rows={2}
                value={fairnessResult.seed}
              />
              <button
                type="button"
                onClick={() => runFairnessVerify()}
                className="rounded border-2 border-[#2d6b3a] bg-[#3d8b4a] px-3 py-1.5 text-xs font-bold text-white"
              >
                Verify Fairness (hash(seed) vs hint seedHash)
              </button>
              {fairnessCheck && <p className="mt-2 text-xs font-semibold text-[#222]">{fairnessCheck}</p>}
            </div>
          )}

          <div className="sticky bottom-0 left-0 right-0 z-20 mt-3 bg-[#efe6d5]/95 py-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={goToBoard}
              className="mx-auto block w-full max-w-[1100px] rounded border-2 border-[#b8a01e] bg-[#f5e14a] py-3.5 text-center text-lg font-black tracking-wide text-black shadow-sm active:scale-[0.99] sm:py-4 sm:text-xl"
            >
              PLAY
            </button>
          </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showRotatePrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm border border-[#3b3b3b] bg-[#111] p-4 text-center text-white">
            <div className="phone-rotate-wrap" aria-hidden>
              <div className="phone-rotate-icon" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Rotate Screen</h3>
            <p className="mb-4 text-sm text-gray-300">
              Lottery quiz works best in landscape mode.
              Please rotate your phone horizontally.
            </p>
            <button
              type="button"
              onClick={handleRotateLandscape}
              className="h-10 w-full border border-[#d4372f] bg-[#ef3f34] font-semibold"
            >
              Rotate + Full Screen
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default LotteryQuizPage;

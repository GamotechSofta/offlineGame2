import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { io } from 'socket.io-client';
import AppLayout from '../components/AppLayout';
import { getQuizHint, getQuizQuestions, getQuizResult, getQuizSlot, postQuizBet } from '../api/quizApi';
import { getQuizSocketUrl } from '../config/api';
import { verifyFairness } from '../utils/quizFairness';

const STUDY_MINUTES = 13;
const SLOT_MINUTES = 15;

const pad2 = (n) => String(n).padStart(2, '0');

const btnInactive = 'bg-[#5c2222] text-white border-2 border-[#3d1515] shadow-inner';
const btnActive = 'bg-[#f5e14a] text-black border-2 border-[#c9b429] shadow-sm';

const formatCountdown = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const LotteryQuizPage = () => {
  const navigate = useNavigate();
  const [selectedQuiz, setSelectedQuiz] = useState(1);
  const [slotData, setSlotData] = useState(null);
  const [slotErr, setSlotErr] = useState('');
  const [questions, setQuestions] = useState([]);
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

  const quizLabel = `QUIZ${pad2(selectedQuiz)}`;

  useEffect(() => {
    selectedQuizRef.current = selectedQuiz;
  }, [selectedQuiz]);

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
      const targetSlot = lastHintSlotRef.current;
      if (!targetSlot || data.slotStartIso !== targetSlot) return;

      const qid = selectedQuizRef.current;
      const row = data.results.find((r) => r.quizId === qid);
      if (!row || row.result == null) return;

      const idx = String(row.result).padStart(2, '0');

      try {
        const j = await getQuizResult(qid, data.slotStartIso);
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
        setGuessFeedback(hit ? `बरोबर — एक किंवा अधिक बेट जिंकले — योग्य क्र. ${idx}` : `चूक — योग्य क्रमांक ${idx}`);
      } else {
        setGuessFeedback(`योग्य क्रमांक: ${idx}`);
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
    getQuizQuestions(selectedQuiz)
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
        const j = await getQuizHint(selectedQuiz);
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
      setGuessFeedback('सध्याचा ड्रॉ स्लॉट बंद आहे किंवा लोड होत आहे — थोडी वाट पहा.');
      return;
    }

    const parsed = [];
    for (const row of betLines) {
      const nRaw = String(row.number ?? '').replace(/\D/g, '').slice(0, 2);
      const amt = Number(String(row.amount ?? '').replace(/[^\d.]/g, ''));
      if (!nRaw && !row.amount) continue;
      if (nRaw.length !== 2) {
        setGuessFeedback('प्रत्येक ओळीसाठी 00–99 दोन अंक भरा किंवा रिकामी ओळ काढा.');
        return;
      }
      const num = parseInt(nRaw, 10);
      if (num < 0 || num > 99 || !Number.isFinite(amt) || amt < 1) {
        setGuessFeedback('प्रत्येक बेट: क्रमांक 00–99 आणि रक्कम किमान १.');
        return;
      }
      parsed.push({ number: num, amount: Math.floor(amt) });
    }

    if (parsed.length === 0) {
      setGuessFeedback('किमान एक बेट (क्रमांक + रक्कम) भरा.');
      return;
    }
    if (parsed.length > 100) {
      setGuessFeedback('एका वेळी कमाल १०० वेगळे क्रमांक.');
      return;
    }

    const seen = new Set();
    for (const p of parsed) {
      if (seen.has(p.number)) {
        setGuessFeedback('एकाच स्लॉटमध्ये समान क्रमांक दोनदा नाही.');
        return;
      }
      seen.add(p.number);
    }

    try {
      const j = await postQuizBet(selectedQuiz, parsed);
      if (j.success && j.data?.bets) {
        lastBetNumbersRef.current = j.data.bets.map((b) => b.number);
      }
    } catch (e) {
      if (e.status === 401) {
        setGuessFeedback('बेट लावण्यासाठी लॉगिन करा (JWT / user token).');
        return;
      }
      if (e.status === 403) {
        setGuessFeedback(e.message || 'या स्लॉटसाठी बेट स्वीकारले जात नाहीत.');
        return;
      }
      if (e.status === 409) {
        setGuessFeedback(e.message || 'बेट नोंदवता आला नाही — पुन्हा प्रयत्न करा.');
        return;
      }
      setGuessFeedback(e.message || 'बेट नोंदवता आला नाही');
      return;
    }

    try {
      const j = await getQuizResult(selectedQuiz, slotStartIso);
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
          hit ? `बेट नोंदवले. बरोबर क्रमांक ${idx} (स्लॉट संपल्यानंतर जिंगणे खात्यात)` : `बेट नोंदवले. योग्य क्र. ${idx}`,
        );
      } else {
        setGuessFeedback('बेट नोंदवले. स्लॉट संपल्यानंतर निकाल दिसेल.');
      }
    } catch (e) {
      if (e.status === 403 && e.code === 'SLOT_NOT_ENDED') {
        setGuessFeedback('बेट नोंदवले. स्लॉट संपल्यानंतर निकाल व Fairness (seed) दिसेल.');
      } else if (e.status === 403) {
        setGuessFeedback('बेट नोंदवले. निकाल नंतर तपासा.');
      } else {
        setGuessFeedback(e.message || 'तपासणी अयशस्वी');
      }
    }
  }, [betLines, slotData, selectedQuiz]);

  const runFairnessVerify = useCallback(async () => {
    if (!fairnessResult?.seed || !fairnessResult?.seedHash) {
      setFairnessCheck('निकालातून seed उपलब्ध नाही.');
      return;
    }
    try {
      const ok = await verifyFairness(fairnessResult.seed, fairnessResult.seedHash);
      setFairnessCheck(ok ? '✓ hash(seed) हिंटमधील seedHash शी जुळते — provably fair.' : '✗ जुळत नाही — तपासा.');
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

  return (
    <AppLayout>
      <div
        className="flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden text-black"
        style={{ backgroundColor: '#efe6d5' }}
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-[#efe6d5]/95 px-2 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => navigate('/lottery')}
            className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold ${btnInactive}`}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            2D
          </button>
          <span className="text-[11px] font-semibold leading-snug text-[#5c2222] sm:text-sm">
            {slotErr
              ? `सर्व्हर: ${slotErr}`
              : hintPhase
                ? `Hint फेज — ड्रॉ: ${slotData?.drawLabelCurrent ?? ''} (${formatCountdown(slotData?.secondsUntilSlotEnd ?? 0)})`
                : `सर्व प्रश्न (सर्व्हर) — ${STUDY_MINUTES} मि. नंतर Hint (${formatCountdown(slotData?.secondsUntilHint ?? 0)})`}
          </span>
        </div>

        <div className="flex flex-1 flex-col px-2 pb-2 sm:px-4">
          <div className="mb-3 flex justify-center gap-2 sm:gap-3">
            <div className={`rounded-xl px-3 py-2 text-xs font-bold sm:px-5 sm:py-2.5 sm:text-sm ${btnInactive} opacity-90`}>
              {slotData?.drawLabelPrev ?? '—'}
            </div>
            <div className={`rounded-xl px-3 py-2 text-xs font-bold sm:px-5 sm:py-2.5 sm:text-sm ${btnActive}`}>
              {slotData?.drawLabelCurrent ?? '—'}
            </div>
            <div className={`rounded-xl px-3 py-2 text-xs font-bold sm:px-5 sm:py-2.5 sm:text-sm ${btnInactive} opacity-90`}>
              {slotData?.drawLabelNext ?? '—'}
            </div>
          </div>

          {(studyPhase || hintPhase) && slotData && (
            <div className="mx-auto mb-3 w-full max-w-[1100px]">
              <p className="mb-1.5 text-center text-[11px] font-semibold text-[#5c2222] sm:text-xs">
                {hintPhase
                  ? 'एका स्लॉटमध्ये प्रत्येक क्विजचा वेगळा प्रश्न व वेगळा निकाल — खाली Q-01…Q-30 निवडून hint पहा व अंदाज लावा.'
                  : 'Study: खाली क्विज निवडा — प्रत्येकास 100 प्रश्न.'}
              </p>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedQuiz(n)}
                    className={`rounded-md py-2 text-center text-[11px] font-bold sm:text-sm ${
                      selectedQuiz === n ? btnActive : btnInactive
                    }`}
                  >
                    Q-{pad2(n)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {studyPhase && (
            <div className="mx-auto w-full max-w-[1100px] flex-1 overflow-x-auto rounded-sm border border-[#8b7355] shadow-md">
              {questionsLoading && <p className="p-4 text-center text-sm">प्रश्न लोड होत आहेत…</p>}
              {questionsErr && <p className="p-4 text-center text-sm text-red-700">{questionsErr}</p>}
              {!questionsLoading && !questionsErr && (
                <table className="w-full min-w-[640px] border-collapse text-left text-[12px] sm:text-[13px]">
                  <thead>
                    <tr className="bg-[#ff9a3c] text-black">
                      <th className="border border-[#c96d20] px-1 py-2 text-center font-bold sm:px-2">{quizLabel}</th>
                      <th className="border border-[#c96d20] px-1 py-2 text-center font-bold sm:px-2">QUESTION</th>
                      <th className="border border-[#c96d20] px-1 py-2 text-center font-bold sm:px-2">OPTIONS</th>
                      <th className="w-[72px] border border-[#c96d20] px-1 py-2 text-center font-bold sm:w-[88px]">ANS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((row, position) => (
                      <tr key={row.id}>
                        <td
                          className="align-top border border-[#7a9e5c] px-2 py-2 font-semibold leading-snug"
                          style={{ backgroundColor: '#b8e6a8' }}
                        >
                          <div>Question No. {pad2(position)}</div>
                          <div className="mt-1 text-[11px] opacity-90">{slotData?.drawLabelCurrent ?? ''}</div>
                        </td>
                        <td
                          className="align-top border border-[#e0a0b0] px-2 py-2 leading-snug"
                          style={{ backgroundColor: '#fcd4dc' }}
                        >
                          {row.question}
                        </td>
                        <td
                          className="align-top border border-[#7eb8d4] px-2 py-2"
                          style={{ backgroundColor: '#cfe9f6' }}
                        >
                          <div className="grid grid-cols-2 gap-1.5 gap-x-2">
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
                            className="w-full min-h-[44px] rounded border border-white/30 bg-white/10 px-1 py-2 text-xs font-bold text-white hover:bg-white/20 sm:text-sm"
                          >
                            {answerRevealed[row.id] ? (
                              <span className="text-lg tracking-widest">{row.answer}</span>
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
              <p className="border-b border-[#dcb] bg-[#fff8e6] px-2 py-1 text-center text-[11px] text-[#5c2222]">
                <span className="font-bold text-[#1a4d6e]">QUIZ{pad2(selectedQuiz)}</span>
                {' · '}
                बेट पूर्ण {SLOT_MINUTES} मि. स्लॉट दरम्यान · Hint शेवटच्या ~२ मि.
              </p>
              {hintPhase && hintData && hintData.quizId === selectedQuiz ? (
                <div className="flex flex-col gap-0 sm:flex-row">
                  <div
                    className="flex w-full shrink-0 items-center justify-center border-b border-[#8b7355] px-3 py-6 text-lg font-bold text-[#1a6b2e] sm:w-[88px] sm:border-b-0 sm:border-r"
                    style={{ backgroundColor: '#e8f5e9' }}
                  >
                    Hint
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="border-b border-[#dcb] px-3 py-3 text-sm leading-relaxed" style={{ backgroundColor: '#fcd4dc' }}>
                      <p className="mb-2 font-medium text-[#4a1515]">
                        फक्त प्रश्नाचा मजकूर (A–D पर्याय study फेजमधील यादीत). प्रश्न क्रमांक सर्व्हरकडे लपलेला.
                      </p>
                      <p className="text-[15px] font-semibold text-black">{hintData.questionText}</p>
                    </div>
                    {hintData.seedHash && (
                      <div className="border-b border-[#dcb] bg-[#f0f4ff] px-3 py-2 text-[11px] leading-snug text-[#1a2a5c]">
                        <span className="font-bold">Fairness hash (commitment):</span>
                        <p className="mt-1 break-all font-mono text-[10px] sm:text-[11px]">{hintData.seedHash}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-b border-[#dcb] bg-[#fff8e6] px-3 py-2 text-center text-[11px] text-[#5c2222]">
                  Hint स्लॉटच्या शेवटच्या ~२ मि. दिसेल. आता Study फेजमध्येही बेट नोंदवता येतात (सर्व्हर स्लॉट उघडा असताना).
                </div>
              )}

              <div className="border-t border-[#8b7355] bg-[#efe6d5] px-3 py-4">
                <p className="mb-2 text-sm font-semibold text-[#5c2222]">
                  प्रश्न क्रमांक (00–99) वर बेट — एका स्लॉटमध्ये कमाल १०० वेगळे क्रमांक; समान क्रमांकावर पुन्हा BUY केल्यास रक्कम जोडते.
                </p>
                <div className="space-y-2">
                  {betLines.map((row, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="w-6 text-xs font-bold text-[#5c2222]">{i + 1}.</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        value={row.number}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setBetLines((prev) => prev.map((r, j) => (j === i ? { ...r, number: v } : r)));
                          setGuessFeedback(null);
                        }}
                        placeholder="क्र."
                        className="w-20 rounded border-2 border-[#5c2222] bg-white px-2 py-2 text-center text-lg font-bold"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.amount}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, '');
                          setBetLines((prev) => prev.map((r, j) => (j === i ? { ...r, amount: v } : r)));
                          setGuessFeedback(null);
                        }}
                        placeholder="रक्कम"
                        className="w-28 rounded border border-[#5c2222] bg-white px-2 py-2 text-center text-sm font-bold"
                      />
                      {betLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBetLines((prev) => prev.filter((_, j) => j !== i))}
                          className="text-xs font-bold text-[#8b2222] underline"
                        >
                          काढा
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {betLines.length < 100 && (
                    <button
                      type="button"
                      onClick={() => setBetLines((prev) => [...prev, { number: '', amount: '' }])}
                      className="rounded border border-[#5c2222] bg-white px-3 py-1.5 text-xs font-bold text-[#5c2222]"
                    >
                      + ओळ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => submitQuizBets()}
                    className="rounded border-2 border-[#1c87cd] bg-[#2d9de8] px-4 py-2 text-sm font-bold text-white"
                  >
                    बेट नोंदवा
                  </button>
                </div>
                {guessFeedback && <p className="mt-2 text-sm font-semibold text-[#3d1515]">{guessFeedback}</p>}
              </div>
            </div>
          )}

          {hintPhase && slotOpenForBuy && (!hintData || hintData.quizId !== selectedQuiz) && (
            <div className="mx-auto py-6 text-center text-sm text-[#5c2222]">
              QUIZ{pad2(selectedQuiz)} साठी hint लोड होत आहे…
            </div>
          )}

          {fairnessResult?.seed && (
            <div className="mx-auto mt-3 w-full max-w-[1100px] rounded-sm border border-[#7a9e5c] bg-[#eef8f0] px-3 py-3 text-sm shadow-sm">
              <p className="mb-1 font-bold text-[#1a4d2e]">
                Fairness (स्लॉट संपल्यानंतर)
                {fairnessResult.quizId != null && (
                  <span className="ml-1 font-mono text-[#0f3558]">· QUIZ{pad2(fairnessResult.quizId)}</span>
                )}
              </p>
              <p className="mb-1 text-xs text-[#333]">
                योग्य क्रमांक: <span className="font-mono font-bold">{fairnessResult.questionIndex}</span>
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

          <button
            type="button"
            onClick={goToBoard}
            className="mx-auto mt-3 w-full max-w-[1100px] rounded border-2 border-[#b8a01e] bg-[#f5e14a] py-3.5 text-center text-lg font-black tracking-wide text-black shadow-sm active:scale-[0.99] sm:py-4 sm:text-xl"
          >
            PLAY
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default LotteryQuizPage;

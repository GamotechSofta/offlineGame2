import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getMyBoardBets, getMyQuizBets } from '../api/quizApi';

const statusLabel = (status) => {
  if (status === 'win') return 'जिंकले';
  if (status === 'lose') return 'हरले';
  if (status === 'pending') return 'प्रलंबित';
  return status || '—';
};

const groupQuizRows = (items) => {
  const map = new Map();
  for (const row of items) {
    const k = `${row.slotStartIso}|${row.quizId}`;
    if (!map.has(k)) {
      map.set(k, {
        slotStartIso: row.slotStartIso,
        quizId: row.quizId,
        drawLabelEnd: row.drawLabelEnd,
        slotEnded: row.slotEnded,
        winningNumber: row.winningNumber,
        lines: [],
      });
    }
    map.get(k).lines.push(row);
  }
  return [...map.values()].map((g) => ({
    ...g,
    lines: [...g.lines].sort((a, b) => Number(a.number) - Number(b.number)),
  }));
};

const MyBetsModal = ({ open, onClose }) => {
  const [tab, setTab] = useState('quiz');
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errBoard, setErrBoard] = useState('');
  const [errQuiz, setErrQuiz] = useState('');
  const [boardItems, setBoardItems] = useState([]);
  const [quizItems, setQuizItems] = useState([]);

  const loadBoard = useCallback(() => {
    setLoadingBoard(true);
    setErrBoard('');
    return getMyBoardBets(40)
      .then((j) => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        setBoardItems(rows);
      })
      .catch((e) => {
        setErrBoard(e.message || 'Failed to load');
      })
      .finally(() => {
        setLoadingBoard(false);
      });
  }, []);

  const loadQuiz = useCallback(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user?.token) {
      setQuizItems([]);
      setErrQuiz('');
      setLoadingQuiz(false);
      return Promise.resolve();
    }
    setLoadingQuiz(true);
    setErrQuiz('');
    return getMyQuizBets(120)
      .then((j) => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        setQuizItems(rows);
      })
      .catch((e) => {
        if (e.status === 401) setErrQuiz('लॉगिन आवश्यक.');
        else setErrQuiz(e.message || 'Failed to load');
      })
      .finally(() => {
        setLoadingQuiz(false);
      });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    loadBoard();
    loadQuiz();
  }, [open, loadBoard, loadQuiz]);

  const quizGroups = useMemo(() => groupQuizRows(quizItems), [quizItems]);

  const refreshQuiz = useCallback(() => {
    loadQuiz();
  }, [loadQuiz]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2">
      <div className="flex max-h-[90vh] w-full max-w-[920px] flex-col border border-[#6c6c6c] bg-[#f1f1f1] text-black">
        <div className="flex shrink-0 items-center justify-between border-b border-[#a1a1a1] bg-[#e3e3e3] px-2 py-1">
          <h3 className="text-[12px] font-semibold">माझे बेट / निकाल</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-6 border border-[#c5362d] bg-[#ef3f34] px-2 text-[11px] text-white"
          >
            Close
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[#c0c0c0] bg-[#dadada] px-2 py-1">
          <button
            type="button"
            onClick={() => setTab('quiz')}
            className={`px-2 py-1 text-[11px] font-semibold ${
              tab === 'quiz' ? 'bg-[#2d9de8] text-white' : 'bg-white text-black border border-[#999]'
            }`}
          >
            Quiz टिकिट (खाते)
          </button>
          <button
            type="button"
            onClick={() => setTab('board')}
            className={`px-2 py-1 text-[11px] font-semibold ${
              tab === 'board' ? 'bg-[#3d9b5c] text-white' : 'bg-white text-black border border-[#999]'
            }`}
          >
            बोर्ड (सेशन)
          </button>
          {tab === 'quiz' && (
            <button
              type="button"
              onClick={() => refreshQuiz()}
              className="ml-auto border border-[#666] bg-white px-2 py-0.5 text-[10px] font-semibold"
            >
              Refresh
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 text-[11px]">
          {tab === 'quiz' && (
            <>
              <p className="mb-2 text-[10px] text-gray-700">
                वॉलेटमधून कापलेले बेट; प्रत्येक नंबरला वेगळी ओळ. स्लॉट संपल्यानंतर जिंक / हार अपडेट.
              </p>
              {loadingQuiz && <p className="text-center">लोड होत आहे…</p>}
              {errQuiz && <p className="text-center text-red-700">{errQuiz}</p>}
              {!loadingQuiz && !errQuiz && quizItems.length === 0 && (
                <p className="text-center text-gray-600">अजून Quiz टिकिट नाही किंवा लॉगिन नाही.</p>
              )}
              {!loadingQuiz &&
                !errQuiz &&
                quizGroups.map((g) => (
                  <div key={`${g.slotStartIso}-${g.quizId}`} className="mb-3 border border-[#bbb] bg-white p-2">
                    <div className="mb-2 font-bold text-[#1a4d6e]">
                      QUIZ{String(g.quizId).padStart(2, '0')} · ड्रॉ: {g.drawLabelEnd ?? '—'}
                      {g.slotEnded && g.winningNumber != null && (
                        <span className="ml-2 font-mono text-[#333]">योग्य क्र.: {g.winningNumber}</span>
                      )}
                    </div>
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#d9e4f5]">
                          <th className="border border-[#a0a0a0] p-1">नंबर</th>
                          <th className="border border-[#a0a0a0] p-1">रक्कम</th>
                          <th className="border border-[#a0a0a0] p-1">स्थिती</th>
                          <th className="border border-[#a0a0a0] p-1">जिंक रक्कम</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.lines.map((row) => (
                          <tr key={row.id} className="bg-[#f8f8f8]">
                            <td className="border border-[#a0a0a0] p-1 font-mono font-semibold">
                              {String(row.number).padStart(2, '0')}
                            </td>
                            <td className="border border-[#a0a0a0] p-1">₹{row.amount}</td>
                            <td
                              className={`border border-[#a0a0a0] p-1 font-semibold ${
                                row.status === 'win'
                                  ? 'text-green-700'
                                  : row.status === 'lose'
                                    ? 'text-red-700'
                                    : 'text-amber-800'
                              }`}
                            >
                              {statusLabel(row.status)}
                            </td>
                            <td className="border border-[#a0a0a0] p-1">
                              {row.status === 'win' && row.winPayout > 0 ? `₹${row.winPayout}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </>
          )}

          {tab === 'board' && (
            <>
              {loadingBoard && <p className="text-center">लोड होत आहे…</p>}
              {errBoard && <p className="text-center text-red-700">{errBoard}</p>}
              {!loadingBoard && !errBoard && boardItems.length === 0 && (
                <p className="text-center text-gray-600">अजून बोर्ड बेट नोंद नाही.</p>
              )}
              {!loadingBoard &&
                boardItems.map((row) => (
                  <div key={row.slotStartIso} className="mb-3 border border-[#bbb] bg-white p-2">
                    <div className="mb-1 font-bold text-[#1a4d6e]">
                      ड्रॉ संपला: {row.drawLabelEnd ?? '—'} · एकूण: {row.totalAmount}
                      {row.slotEnded && row.netResult != null && (
                        <span className={row.netResult >= 0 ? ' text-green-700' : ' text-red-700'}>
                          {' '}
                          → निकाल: {row.netResult >= 0 ? 'फायदा' : 'तोटा'} ({row.netResult})
                        </span>
                      )}
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#d9e4f5]">
                          <th className="border border-[#a0a0a0] p-1">Quiz-नंबर</th>
                          <th className="border border-[#a0a0a0] p-1">रक्कम</th>
                          <th className="border border-[#a0a0a0] p-1">योग्य क्र.</th>
                          <th className="border border-[#a0a0a0] p-1">जिंकले?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(row.lines || []).map((ln, i) => (
                          <tr key={`${row.slotStartIso}-${i}`} className="bg-[#f8f8f8]">
                            <td className="border border-[#a0a0a0] p-1 font-mono">{ln.cellLabel}</td>
                            <td className="border border-[#a0a0a0] p-1">{ln.amount}</td>
                            <td className="border border-[#a0a0a0] p-1 font-mono">{ln.winningIndex ?? '—'}</td>
                            <td className="border border-[#a0a0a0] p-1">
                              {ln.won === null ? '—' : ln.won ? 'हो' : 'नाही'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyBetsModal;

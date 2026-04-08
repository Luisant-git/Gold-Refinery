// client/src/components/PrintReceipt.jsx
import React, { useEffect, useState } from 'react';
import { fmtDate } from '../db/utils';
import { pureTokenAPI } from '../db/api';

export default function PrintReceipt({ voucher, type, onClose }) {
  const [masterPureToken, setMasterPureToken] = useState('');
  const [masterPureTouch, setMasterPureTouch] = useState('');
  useEffect(() => {
    pureTokenAPI.getAll()
      .then(rows => {
        if (rows && rows.length > 0) {
          const tokenValue =
            rows[0]?.token_no ||
            rows[0]?.token ||
            rows[0]?.value ||
            '';

          const touchValue =
            rows[0]?.touch ||
            rows[0]?.pure_touch ||
            rows[0]?.touch_value ||
            '';

          setMasterPureToken(tokenValue);
          setMasterPureTouch(touchValue);
        }
      })
      .catch(() => {
        setMasterPureToken('');
        setMasterPureTouch('');
      });
  }, []);

  const isExchange = type === 'exchange';
  const isSales = type === 'sales';
  const isPurchase = type === 'purchase';

  const floorTo3Decimal = (num) => {
    const n = parseFloat(num) || 0;
    return Math.floor(n * 1000) / 1000;
  };

  const items = voucher.items || [];
  const date = fmtDate(voucher.voucher_date);
  const rate = parseFloat(voucher.rate_per_gram || 0);
const pureTouchVal = parseFloat(voucher.pure_touch || masterPureTouch || 99.92);

const actualPureWt = floorTo3Decimal(
  parseFloat(voucher.actual_pure_gold || voucher.actual_pure_wt || 0)
);

const netPureOwed = floorTo3Decimal(
  parseFloat(voucher.total_pure_wt || 0)
);

const pureGoldGiven = parseFloat(voucher.pure_wt_given || voucher.pure_gold_given || 0);
const convertedGivenGold = pureGoldGiven > 0
  ? floorTo3Decimal((pureGoldGiven * pureTouchVal) / 100)
  : 0;

const cashGiven = parseFloat(voucher.cash_given || voucher.cash_for_remaining || 0);
const requiredCash = parseFloat(voucher.required_cash || 0);
const extraCash = parseFloat(voucher.extra_cash || 0);

const hasOB = isExchange && Math.abs(netPureOwed - actualPureWt) > 0.001;
const obAmount = hasOB ? floorTo3Decimal(actualPureWt - netPureOwed) : 0;

const rawGoldBalance = floorTo3Decimal(convertedGivenGold - netPureOwed);

const isCashSettled =
  isExchange &&
  requiredCash > 0 &&
  cashGiven > 0 &&
  cashGiven >= requiredCash * 0.99;

const closingBalance = isCashSettled ? 0 : rawGoldBalance;
const isNilBalance = isExchange && Math.abs(closingBalance) < 0.001;
  const totalKatcha = items.reduce((s, r) => s + (parseFloat(r.katcha_wt) || 0), 0);
  const totalWt = parseFloat(voucher.total_gross_wt || 0);
  const grossAmt = parseFloat(voucher.gross_amount || 0);
  const netAmt = parseFloat(voucher.net_amount || 0);
  const deductions = parseFloat(voucher.deductions || 0);

  const totalPure = items.reduce(
    (s, r) =>
      s +
      (
        parseFloat(r.pure_wt) ||
        ((parseFloat(r.katcha_wt || r.gross_wt || 0) * parseFloat(r.touch || 0)) / 100)
      ),
    0
  );

  const r = { fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 };
  const row = { display: 'flex', justifyContent: 'space-between', marginBottom: 1 };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-receipt, .print-receipt * { visibility: visible !important; }
          .print-receipt {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 80mm !important; margin: 0 !important; padding: 0 !important;
            box-shadow: none !important; border: none !important;
            font-size: 11pt !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', maxHeight: '95vh', overflowY: 'auto', minWidth: 380, maxWidth: 440 }}>

          {/* Controls - hidden on print */}
          <div className="no-print" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: '#F8F3EA', borderBottom: '1px solid #ddd',
          }}>
            <strong style={{ fontSize: 13, color: '#5A3E00' }}>Print Preview — {voucher.voucher_no}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} style={{
                background: '#6B4A00', color: '#FFF5D6', border: 'none',
                padding: '7px 18px', borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>🖨 Print</button>
              <button onClick={onClose} style={{
                background: 'none', border: '1px solid #bbb', borderRadius: 5,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#666',
              }}>✕ Close</button>
            </div>
          </div>

          {/* RECEIPT BODY */}
          <div className="print-receipt" style={{
            ...r, padding: '16px 18px', color: '#000', background: '#fff',
          }}>

            {/* ── Header ── */}
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, marginBottom: 2 }}>श्री</div>
              <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, marginBottom: 2 }}>ESTIMATE ONLY</div>
              {/* <div style={{ fontSize:9, letterSpacing:1 }}>
                ✦✦✦ {isExchange ? 'GOLD EXCHANGE' : isSales ? 'SALES' : 'PURCHASE'} ✦✦✦
              </div> */}
            </div>

            {/* ── Date + Bill No ── */}
            <div style={{ borderTop: '1.5px solid #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 6, ...row }}>
              <span>Date : {date}</span>
              <span style={{ fontWeight: 'bold' }}>{voucher.voucher_no}</span>
            </div>

            {/* ── Customer ── */}
            <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 12 }}>
              {voucher.customer_name}
              {/* <span style={{ fontWeight:'normal', marginLeft:10, fontSize:11 }}>{voucher.mobile}</span> */}
            </div>

            {/* ── Items table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 4 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', paddingBottom: 3, width: 28, fontWeight: 'bold' }}>SNo</th>
                  <th style={{ textAlign: 'left', paddingBottom: 3, fontWeight: 'bold' }}>Token</th>
                  <th style={{ textAlign: 'right', paddingBottom: 3, fontWeight: 'bold' }}>Weight</th>
                  <th style={{ textAlign: 'right', paddingBottom: 3, fontWeight: 'bold' }}>Touch</th>
                  <th style={{ textAlign: 'right', paddingBottom: 3, fontWeight: 'bold' }}>
                    {(isExchange || isSales) ? 'Pure' : '₹'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isExchange
                  ? items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: '2px 0' }}>{item.sno || i + 1}.</td>
                      <td style={{ padding: '2px 4px' }}>{item.token_no || '—'}</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                        {parseFloat(item.katcha_wt || 0).toFixed(3)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                        {parseFloat(item.balance_touch || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold' }}>
                        {parseFloat(item.pure_wt || 0).toFixed(3)}
                      </td>
                    </tr>
                  ))
                  : isSales
                    ? items.map((item, i) => {
                      const weight = parseFloat(item.katcha_wt || item.gross_wt || 0);
                      const touch = parseFloat(item.touch || 0);
                      const pure = parseFloat(item.pure_wt || ((weight * touch) / 100));
                      return (
                        <tr key={i}>
                          <td style={{ padding: '2px 0' }}>{item.sno || i + 1}.</td>
                          <td style={{ padding: '2px 4px' }}>{item.token_no || item.item_description || '—'}</td>
                          <td style={{ textAlign: 'right', padding: '2px 4px' }}>{weight.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', padding: '2px 4px' }}>{touch.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold' }}>{pure.toFixed(3)}</td>
                        </tr>
                      );
                    })
                    : items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: '2px 0' }}>{item.sno || i + 1}.</td>
                        <td style={{ padding: '2px 4px' }}>{item.item_description || '—'}</td>
                        <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                          {parseFloat(item.katcha_wt || item.gross_wt || 0).toFixed(3)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                          {parseFloat(item.touch || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold' }}>
                          ₹{parseFloat(item.amount || 0).toFixed(0)}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>

            {/* ── EXCHANGE SECTION ── */}
            {isExchange && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 4, marginBottom: 6 }}>
                {/* Total weight + pure row */}
                <div style={{ ...row, fontWeight: 'bold' }}>
                  <span>{totalKatcha.toFixed(3)}  Total</span>
                  <span>{actualPureWt.toFixed(3)}</span>
                </div>

                {/* OB — only if exists */}
                {hasOB && (
                  <div style={{ ...row }}>
                    <span style={{ paddingLeft: 20 }}>O.B</span>
                    <span style={{ fontWeight: 'bold' }}>
                      {obAmount > 0 ? `- ${obAmount.toFixed(3)}` : `+ ${Math.abs(obAmount).toFixed(3)}`}
                    </span>
                  </div>
                )}

                {/* Net pure line after OB */}
               <div style={{ borderTop: '1px dashed #000', ...row, paddingTop: 3, fontWeight: 'bold' }}>
  <span>NET PURE</span>
  <span>{netPureOwed.toFixed(3)}</span>
</div>

                {/* PURE GOLD calc */}
                <div style={{ marginTop: 6, marginBottom: 4 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 2 }}>PURE GOLD</div>
                  <div style={{ ...row }}>
                    <span>{pureGoldGiven.toFixed(3)} × {pureTouchVal.toFixed(2)}%</span>
                    <span style={{ fontWeight: 'bold' }}>{convertedGivenGold.toFixed(3)}</span>
                  </div>
                </div>

                {/* Pure gold given — removed from print */}

                {/* Cash given */}
                {requiredCash > 0 && (
                  <div style={{ ...row }}>
                    <span>REQUIRED CASH</span>
                    <span style={{ fontWeight: 'bold' }}>₹{requiredCash.toLocaleString('en-IN')}</span>
                  </div>
                )}

                {cashGiven > 0 && (
                  <div style={{ ...row }}>
                    <span>CASH GIVEN</span>
                    <span style={{ fontWeight: 'bold' }}>₹{cashGiven.toLocaleString('en-IN')}</span>
                  </div>
                )}

                {extraCash > 0 && (
                  <div style={{ ...row }}>
                    <span>EXTRA CASH</span>
                    <span style={{ fontWeight: 'bold' }}>₹{extraCash.toLocaleString('en-IN')}</span>
                  </div>
                )}

                {/* Closing balance */}
                <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 4, ...row }}>
  <span>CLOSING BALANCE</span>
  <span style={{ fontWeight: 'bold' }}>
    {isCashSettled
      ? 'NIL'
      : isNilBalance
        ? 'NIL'
        : `${closingBalance > 0 ? '+' : ''}${closingBalance.toFixed(3)} g`}
  </span>
</div>

                {/* Token + touch */}
                <div style={{ marginTop: 6, fontSize: 10 }}>
                  <div>PURE TOKEN No. {masterPureToken || '—'} &nbsp;&nbsp; TOUCH : {pureTouchVal.toFixed(2)}</div>
                  {rate > 0 && <div>RATE : ₹{rate.toLocaleString('en-IN')}/g</div>}
                </div>
              </div>
            )}

            {/* ── SALES / PURCHASE SECTION ── */}
            {(isSales || isPurchase) && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 4, marginBottom: 6 }}>
                <div style={{ ...row, fontWeight: 'bold' }}>
                  <span>{totalWt.toFixed(3)} Total</span>
                  <span>{totalPure.toFixed(3)}</span>
                </div>

                <div style={{ ...row, marginTop: 4 }}>
                  <span>GROSS AMOUNT</span>
                  <span style={{ fontWeight: 'bold' }}>
                    ₹{(Math.floor(grossAmt / 10) * 10).toLocaleString('en-IN')}
                  </span>
                </div>

                {deductions > 0 && (
                  <div style={{ ...row }}>
                    <span>DEDUCTIONS</span>
                    <span>- ₹{deductions.toFixed(2)}</span>
                  </div>
                )}

                <div style={{ borderTop: '1px solid #000', paddingTop: 3, marginTop: 4, ...row }}>
                  <span style={{ fontWeight: 'bold' }}>
                    {isSales ? 'NET PAYABLE TO CUSTOMER' : 'AMOUNT TO PAY'}
                  </span>
                  <span style={{ fontWeight: 'bold', fontSize: 13 }}>
                    ₹{(Math.floor(netAmt / 10) * 10).toLocaleString('en-IN')}
                  </span>
                </div>

                <div style={{ marginTop: 6, fontSize: 10 }}>
                  <div>
                    PURE TOKEN No. {masterPureToken || '—'} &nbsp;&nbsp; TOUCH : {pureTouchVal.toFixed(2)}
                  </div>
                  {rate > 0 && (
                    <div>
                      RATE : ₹{rate.toLocaleString('en-IN')}/g
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Remarks — only if exists */}
            {voucher.remarks && (
              <div style={{ fontSize: 10, color: '#444', margin: '6px 0', borderTop: '1px dashed #ccc', paddingTop: 4 }}>
                Note: {voucher.remarks}
              </div>
            )}

            {/* Signature */}
            <div style={{ marginTop: 28, marginBottom: 6 }}>
              <div style={{ borderBottom: '1px solid #000', width: 25, marginBottom: 4 }}></div>
              <div style={{ fontSize: 9 }}>Bits</div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1.5px solid #000', paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <div>
                {/* <div>Bill No. &nbsp;{voucher.voucher_no}</div> */}
                <div>Name &nbsp;&nbsp;Vikram</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {/* <div>Date : {date}</div> */}
                {/* <div>Weight &nbsp;{isExchange ? totalKatcha.toFixed(3) : totalWt.toFixed(3)}</div> */}
              </div>
            </div>

          </div>{/* end .print-receipt */}
        </div>
      </div>
    </>
  );
}

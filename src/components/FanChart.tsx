import { useState } from 'react';
import { DisplayCurrency } from '../types';
import { SimOutput } from '../lib/monteCarlo';
import { fmtCompact } from '../lib/format';

interface Props {
  sim: SimOutput;
  currency: DisplayCurrency;
  retirementYear: number;
}

const W = 720, H = 240, M = { top: 18, right: 86, bottom: 26, left: 52 };

function niceStep(raw: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
}

export default function FanChart({ sim, currency, retirementYear }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const { years, p10, p50, p90 } = sim;
  const n = years.length;
  if (n < 2) return null;

  const yMax = Math.max(...p90, 1) * 1.05;
  const x = (i: number) => M.left + (i / (n - 1)) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - v / yMax) * (H - M.top - M.bottom);

  const line = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const band =
    p90.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') +
    p10.map((v, i) => `L${x(n - 1 - i).toFixed(1)},${y(p10[n - 1 - i]).toFixed(1)}`).join('') + 'Z';

  const step = niceStep(yMax / 4);
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);

  const xTickEvery = Math.ceil(n / 8);
  const retIdx = years.indexOf(retirementYear);
  const depIdx = sim.medianDepletionYear ? years.indexOf(sim.medianDepletionYear) : -1;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - M.left) / (W - M.left - M.right)) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <div className="fanchart-wrap">
      <div className="fanchart-title">Portfolio balance — 1,000 simulated futures ({currency}, nominal)</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="fanchart" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={M.left - 6} y={y(v) + 3.5} textAnchor="end" className="axis-text">{fmtCompact(v, currency)}</text>
          </g>
        ))}
        {years.map((yr, i) =>
          i % xTickEvery === 0 ? (
            <text key={yr} x={x(i)} y={H - 8} textAnchor="middle" className="axis-text">{yr}</text>
          ) : null
        )}
        <path d={band} fill="#cde2fb" fillOpacity={0.75} />
        <path d={line(p50)} fill="none" stroke="#2a78d6" strokeWidth={2} />
        {retIdx > 0 && (
          <g>
            <line x1={x(retIdx)} x2={x(retIdx)} y1={M.top} y2={H - M.bottom} stroke="#c3c2b7" strokeWidth={1} strokeDasharray="3 4" />
            <text x={x(retIdx) + 4} y={M.top + 8} className="axis-text">retire</text>
          </g>
        )}
        {depIdx >= 0 && (
          <g>
            <circle cx={x(depIdx)} cy={y(0)} r={4} fill="#d03b3b" />
            <text x={Math.min(x(depIdx) + 6, W - M.right)} y={y(0) - 6} className="axis-text warn-text">
              ⚠ median runs out {sim.medianDepletionYear}
            </text>
          </g>
        )}
        <text x={W - M.right + 6} y={y(p50[n - 1]) + 3} className="chart-label">median</text>
        <text x={W - M.right + 6} y={y(p90[n - 1]) + 3} className="chart-label muted-label">10–90%</text>
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} stroke="#898781" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(p50[hover])} r={3.5} fill="#2a78d6" stroke="#fff" strokeWidth={1.5} />
            {(() => {
              const boxX = Math.min(x(hover) + 8, W - M.right - 148);
              return (
                <g>
                  <rect x={boxX} y={M.top} width={142} height={62} rx={6} fill="#0f172a" opacity={0.92} />
                  <text x={boxX + 8} y={M.top + 15} className="tip-text tip-strong">{years[hover]}</text>
                  <text x={boxX + 8} y={M.top + 29} className="tip-text">best 10%: {fmtCompact(p90[hover], currency)}</text>
                  <text x={boxX + 8} y={M.top + 43} className="tip-text">median: {fmtCompact(p50[hover], currency)}</text>
                  <text x={boxX + 8} y={M.top + 57} className="tip-text">worst 10%: {fmtCompact(p10[hover], currency)}</text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}

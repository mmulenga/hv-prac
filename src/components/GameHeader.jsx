export default function GameHeader({ title, onBack, round, totalRounds, score, extra }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-hv-border bg-hv-card">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-hv-muted hover:text-white transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="text-center">
        <h1 className="text-white font-semibold text-base">{title}</h1>
        {round !== undefined && totalRounds !== undefined && (
          <p className="text-hv-muted text-xs mt-0.5">
            {round} / {totalRounds}
          </p>
        )}
      </div>

      <div className="text-right min-w-[60px]">
        {score !== undefined && (
          <div>
            <p className="text-white font-bold text-lg leading-none">{score}</p>
            <p className="text-hv-muted text-xs">score</p>
          </div>
        )}
        {extra && <div>{extra}</div>}
      </div>
    </div>
  )
}

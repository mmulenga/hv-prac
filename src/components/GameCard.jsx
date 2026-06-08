export default function GameCard({ game, score, onPlay }) {
  const hasScore = score !== undefined && score !== null

  return (
    <div className="bg-hv-card border border-hv-border rounded-2xl overflow-hidden flex flex-col hover:border-hv-accent-light transition-colors duration-200 animate-fade-in">
      {/* Gradient top bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${game.gradient}`} />

      <div className="p-5 flex flex-col flex-1">
        {/* Icon + title */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">{game.icon}</span>
          <div>
            <h2 className="text-white font-semibold text-lg leading-tight">{game.title}</h2>
            <p className="text-hv-muted text-xs mt-0.5">{game.rounds} rounds</p>
          </div>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">
          {game.description}
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {game.skills.map(skill => (
            <span
              key={skill}
              className="text-xs px-2 py-0.5 rounded-full bg-hv-border text-hv-muted"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Score + play */}
        <div className="flex items-center justify-between gap-3">
          {hasScore ? (
            <div className="text-sm">
              <span className="text-hv-muted">Best: </span>
              <span className="text-white font-semibold">{score.display}</span>
            </div>
          ) : (
            <span className="text-hv-muted text-sm">Not played</span>
          )}
          <button
            onClick={onPlay}
            className={`px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r ${game.gradient} hover:opacity-90 active:scale-95 transition-all duration-150 whitespace-nowrap`}
          >
            {hasScore ? 'Play Again' : 'Play'}
          </button>
        </div>
      </div>
    </div>
  )
}

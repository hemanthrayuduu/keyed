type JoinBracketProps = {
  /** Lit once both files are parsed and the keys are chosen. */
  active: boolean
}

/**
 * The two source panels are tied into one stem that feeds the rail below.
 * This is the join, drawn: two inputs, one output.
 */
export function JoinBracket({ active }: JoinBracketProps) {
  const stroke = active ? 1.25 : 1
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 32"
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="presentation"
    >
      <defs>
        <linearGradient id="join-tie" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2B3FD9" />
          <stop offset="100%" stopColor="#E0A008" />
        </linearGradient>
      </defs>
      {/* left arm, right arm, then the shared stem */}
      <path
        d="M100 0 V8 Q100 16 112 16 H288 Q300 16 300 8 V0"
        fill="none"
        stroke={active ? 'url(#join-tie)' : '#151A21'}
        strokeOpacity={active ? 1 : 0.2}
        strokeWidth={stroke}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M200 16 V32"
        fill="none"
        stroke={active ? '#E0A008' : '#151A21'}
        strokeOpacity={active ? 1 : 0.2}
        strokeWidth={stroke}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="200" cy="16" r="2.5" fill="#151A21" fillOpacity={active ? 1 : 0.25} />
    </svg>
  )
}

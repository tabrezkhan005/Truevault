/**
 * Decorative mock of an audit table — not real records, no hashes shown.
 */

type AuditIllustrationProps = {
  /** Tighter spacing so the table fits inside a full-viewport hero. */
  compact?: boolean;
};

export function AuditIllustration({ compact = false }: AuditIllustrationProps) {
  const rows = [
    {
      time: "09:14",
      actor: "owner@demo.test",
      action: "upload",
      outcome: "allowed" as const,
    },
    {
      time: "09:16",
      actor: "viewer@demo.test",
      action: "download",
      outcome: "allowed" as const,
    },
    {
      time: "09:18",
      actor: "stranger@demo.test",
      action: "view",
      outcome: "denied" as const,
    },
    {
      time: "09:21",
      actor: "owner@demo.test",
      action: "grant_revoke",
      outcome: "allowed" as const,
    },
    {
      time: "09:22",
      actor: "viewer@demo.test",
      action: "download",
      outcome: "denied" as const,
    },
  ];

  const visibleRows = compact ? rows.slice(0, 4) : rows;
  const cellY = compact ? "py-2" : "py-3";
  const headY = compact ? "py-2" : "py-3";

  return (
    <div
      className={
        compact
          ? "relative mx-auto w-full max-w-5xl min-h-0 px-0"
          : "relative mx-auto mt-8 mb-0 w-full max-w-6xl px-2 sm:mt-10 sm:px-0"
      }
    >
      <div className="absolute inset-0 rounded-lg bg-white/10 bg-grainy opacity-30 blur-[4rem]" />
      <figure
        aria-hidden="true"
        className="relative max-h-full overflow-hidden rounded-lg border border-white/15 bg-zinc-950/90 shadow-xl"
      >
        <div
          className={`flex items-center gap-2 border-b border-white/10 px-4 ${compact ? "py-2" : "py-3"}`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" />
          <span className="ml-3 text-xs font-medium tracking-wide text-zinc-400">
            audit log · sample
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <th className={`px-4 ${headY} font-medium`}>Time</th>
                <th className={`px-4 ${headY} font-medium`}>Actor</th>
                <th className={`px-4 ${headY} font-medium`}>Action</th>
                <th className={`px-4 ${headY} font-medium`}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={`${row.time}-${row.actor}-${row.action}`}
                  className="border-b border-white/5 text-zinc-300"
                >
                  <td
                    className={`whitespace-nowrap px-4 ${cellY} font-mono text-xs text-zinc-400`}
                  >
                    {row.time}
                  </td>
                  <td className={`px-4 ${cellY} font-mono text-xs sm:text-sm`}>
                    {row.actor}
                  </td>
                  <td className={`px-4 ${cellY} font-mono text-xs sm:text-sm`}>
                    {row.action}
                  </td>
                  <td className={`px-4 ${cellY}`}>
                    <span
                      className={
                        row.outcome === "allowed"
                          ? "inline-flex rounded-full bg-teal-500/20 px-2.5 py-0.5 text-xs font-medium text-teal-300"
                          : "inline-flex rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-medium text-rose-300"
                      }
                    >
                      {row.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!compact ? (
          <figcaption className="border-t border-white/10 px-4 py-3 text-center text-xs text-zinc-500">
            Illustrative example
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="relative z-10 py-10 px-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          &copy; {new Date().getFullYear()} Johnathon Glover
        </span>
        <span className="text-xs sm:text-right max-w-xl" style={{ color: 'var(--text-dim)' }}>
          Generative AI tools assisted with code and copy on this site. All design decisions,
          results and figures were reviewed and validated before publication.
        </span>
      </div>
    </footer>
  );
}

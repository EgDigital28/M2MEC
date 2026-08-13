export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-secondary text-xs font-bold text-white">
            M2
          </span>
          <span className="text-sm font-medium">M2MEC</span>
        </div>

        <p className="text-sm text-muted">
          Machine-to-Machine Edge Communications
        </p>

        <p className="text-sm text-muted">
          &copy; {year} M2MEC. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

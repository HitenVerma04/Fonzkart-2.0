// The name as lettering: "Fonz" in ink (white in dark mode) and "kart" in the brand green. `split` wraps every letter
// so the page transition can raise them one by one.

const letters = (word: string, split: boolean) =>
    split
        ? [...word].map((c, i) => (
              <span key={i} className="fz-ch">
                  <span>{c}</span>
              </span>
          ))
        : word;

export function Wordmark({ className = '', split = false }: { className?: string; split?: boolean }) {
    return (
        <span className={`fz-wordmark ${className}`} aria-label="Fonzkart" role="img">
            <span className="fz-fonz">{letters('Fonz', split)}</span>
            <span className="fz-kart">{letters('kart', split)}</span>
        </span>
    );
}

export default Wordmark;

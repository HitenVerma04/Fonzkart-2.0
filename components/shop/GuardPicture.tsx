// A screen guard card's picture, as in the Customer app. A photo that already shows the guard floats gently; otherwise
// the model's real photo is turned a little and a guard cut to that model's shape floats in front of it. Pure CSS motion.
import { GUARD_FITS, type GuardFit } from '@/lib/guard-photos';

const WHOLE_PHOTO: GuardFit = { c: [0, 0, 1, 1], a: 0.8, g: 0.47, r: 0, gr: 0.13, cut: 'hole' };

export function GuardPicture({ model, photo }: { model: string; photo: string | null }) {
    if (!photo || /\.svg($|\?)/i.test(photo)) {
        return <div className="flex aspect-square items-center justify-center rounded-xl bg-white text-xs text-slate-400">Photo coming soon</div>;
    }
    const fit = GUARD_FITS[model] ?? WHOLE_PHOTO;
    if (fit.f) {
        return (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`${model} with its screen guard`} loading="lazy" className="guard-float max-h-full max-w-full rounded-lg object-contain" />
            </div>
        );
    }
    // Sizes as shares of the stage, so the picture scales with the card.
    let height = 86;
    const span = height * fit.a + height * fit.g * 0.42;
    if (span > 96) height *= 96 / span;
    const width = height * fit.a;
    const glass = height * fit.g;
    const left = (100 - width - glass * 0.42) / 2;
    const top = (100 - height) / 2;
    const [x, y, w, h] = fit.c;
    const hole = glass * 0.075;
    const cut = fit.cut === 'hole'
        ? { width: `${hole / glass * 100}%`, aspectRatio: '1', borderRadius: '50%', top: '2.4%' }
        : fit.cut === 'island'
            ? { width: '30%', aspectRatio: '3.4', borderRadius: 99, top: '2.2%' }
            : { width: '40%', aspectRatio: '4', borderRadius: '0 0 8px 8px', top: -1 };
    return (
        <div className="relative aspect-square overflow-hidden rounded-xl bg-white [perspective:420px]">
            <div className="absolute overflow-hidden" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, borderRadius: `${fit.r * 100}% / ${fit.r * 100 * fit.a}%`, transform: 'rotateY(12deg)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={model} loading="lazy" className="absolute max-w-none" style={{ left: `${-x / w * 100}%`, top: `${-y / h * 100}%`, width: `${100 / w}%`, height: `${100 / h}%` }} />
            </div>
            <div className="guard-drift absolute flex justify-center overflow-hidden border-[1.5px] border-[#101412] bg-white/15" style={{ left: `${left + width - glass * 0.58}%`, top: `${top}%`, width: `${glass}%`, height: `${height}%`, borderRadius: `${fit.gr * 100}% / ${fit.gr * 100 * fit.g}%` }}>
                <span className="guard-glint absolute -top-[20%] h-[140%] w-[30%] bg-white/30" />
                {fit.cut === 'none' ? null : <span className="absolute border border-[#101412]" style={cut} />}
            </div>
        </div>
    );
}

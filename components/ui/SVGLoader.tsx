import { BrandLoader } from "@/components/ui/BrandLoader";

/** The loader shown inside lists while they load: the Fonzkart cart over the name (see BrandLoader). */
export default function SVGLoader({ className = "" }: { className?: string }) {
    return <BrandLoader className={className} />;
}

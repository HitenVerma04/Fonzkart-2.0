import { BrandLoader } from "@/components/ui/BrandLoader";
import { NavPending } from "@/components/nav/nav-events";

// While a page loads: the cart and the name. NavPending keeps the page transition up until the page is ready.
export default function Loading() {
    return (
        <>
            <NavPending />
            <BrandLoader fullscreen />
        </>
    );
}

// Which device-only questions a phone gets (questionnaire `showFor`), by its model name. The apps decide the same way
// (mobile/packages/core/src/questionnaire.ts → deviceTraits, sideKeyOf); keep the two in step.

/** Words in a folding phone's name (Galaxy Z Fold / Flip, Razr, OnePlus Open), as the backend's PartCatalog. */
const FOLD_WORDS = ['fold', 'flip', 'razr', 'duo', 'open', 'magic v'];

/** The extra side key a phone has: iPhone ring / silent switch or Action Button, OnePlus Alert Slider or Plus Key. */
export type SideKey = 'ring_switch' | 'action_button' | 'alert_slider' | 'plus_key';
const SIDE_KEYS: string[] = ['ring_switch', 'action_button', 'alert_slider', 'plus_key'];

/** The side key of a phone, by its name (null: none, as on Samsung, OnePlus 10T or the Nord CE and N phones). */
export function sideKeyOf(deviceName: string): SideKey | null {
    const name = deviceName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (name.includes('iphone')) {
        // iPhone 15 Pro and every iPhone from the 16 on (16e, 17 Air, Duo too) have the Action Button; older ones the switch.
        const n = Number(/iphone (\d+)/.exec(name)?.[1] ?? 0);
        if (n === 0) return /iphone (air|duo)/.test(name) ? 'action_button' : 'ring_switch'; // X, XR, XS: switch
        if (n >= 16 || (n === 15 && name.includes('pro'))) return 'action_button';
        return 'ring_switch';
    }
    if (!name.includes('oneplus')) return null;
    if (/nord ce|nord n|oneplus n\d|oneplus 10t/.test(name)) return null;
    if (/oneplus (13s|15)|oneplus nord 5\b/.test(name)) return 'plus_key';
    if (/oneplus (8|9|10|11|12|13)|oneplus open|oneplus nord( [1-4]t?\b|$| 5g)/.test(name)) return 'alert_slider';
    return null;
}

export interface DeviceTraits {
    apple: boolean;
    foldable: boolean;
    sideKey: SideKey | null;
}

/** Whether a device name is an iPhone, whether it folds, and its side key. */
export function deviceTraits(deviceName: string): DeviceTraits {
    const name = ` ${deviceName.toLowerCase()} `;
    return { apple: name.includes('iphone'), foldable: FOLD_WORDS.some(w => name.includes(` ${w}`)), sideKey: sideKeyOf(deviceName) };
}

/**
 * Whether a step, section or option with this `showFor` is shown for the device (none: for every device): apple,
 * android, foldable, or a side key (ring_switch, action_button, alert_slider, plus_key).
 */
export function shownFor(showFor: string | undefined, traits: DeviceTraits): boolean {
    if (!showFor) return true;
    if (showFor === 'apple') return traits.apple;
    if (showFor === 'android') return !traits.apple;
    if (showFor === 'foldable') return traits.foldable;
    if (SIDE_KEYS.includes(showFor)) return traits.sideKey === showFor;
    return true;
}

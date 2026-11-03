// Where the launch animation's icons land: the real buttons register themselves here, and the animation asks where
// they are on screen just before it flies to them.
type Measurable = { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => void };

export type LaunchSpot = { x: number; y: number; width: number; height: number };

const views = new Map<string, Measurable>();
const refs = new Map<string, (view: Measurable | null) => void>();

/** A ref for the button that the icon `id` flies to. */
export function launchTarget(id: string) {
  let ref = refs.get(id);
  if (!ref) {
    ref = view => {
      if (view) views.set(id, view);
      else views.delete(id);
    };
    refs.set(id, ref);
  }
  return ref;
}

/** Where that button is in the window, or null when it is not on any open screen. */
export function measureLaunchTarget(id: string): Promise<LaunchSpot | null> {
  return new Promise(resolve => {
    const view = views.get(id);
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve(width || height ? { x, y, width, height } : null));
  });
}

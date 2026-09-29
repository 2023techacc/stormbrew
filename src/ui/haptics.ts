import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Vibration feedback. In the Android app this uses the phone's haptics; in a
 * browser it falls back to the vibration API where there is one (not on iPhone).
 */
export type Buzz = 'light' | 'medium' | 'heavy' | 'success' | 'failure';

let enabled = true;

export function setVibrationEnabled(on: boolean): void {
  enabled = on;
}

const IMPACTS: Record<'light' | 'medium' | 'heavy', ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

export function buzz(kind: Buzz): void {
  if (!enabled) return;
  const done = kind === 'success' || kind === 'failure'
    ? Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error })
    : Haptics.impact({ style: IMPACTS[kind] });
  // No vibration motor, or the browser doesn't allow it: nothing to do.
  done.catch(() => {});
}

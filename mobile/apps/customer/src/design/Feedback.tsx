// Messages: inline notices, and the empty and error states that fill a screen.
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { radii, type } from './tokens';

type Tone = 'info' | 'success' | 'error';

export function Notice({ text, tone = 'info' }: { text: string; tone?: Tone }) {
  const colors = useColors();
  const styles = useStyles();
  const t = tone === 'success'
    ? { background: colors.greenSoft, border: colors.greenBorder, text: colors.greenDark, icon: 'check' as const }
    : { ...colors[tone], icon: tone === 'error' ? ('alert' as const) : ('sparkle' as const) };
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.notice, { backgroundColor: t.background, borderColor: t.border }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
    >
      <Icon name={t.icon} color={t.text} size={18} />
      <Text style={[styles.noticeText, { color: t.text }]}>{text}</Text>
    </Animated.View>
  );
}

export function EmptyState({ icon = 'box', title, message, action }: {
  icon?: IconName;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <View style={styles.badge}>
        <Icon name={icon} color={colors.green} size={34} filled />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <View style={styles.action}>
          <Button title={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** `error`: the failure itself; its reason is shown in small type under the message, so a screenshot says what broke. */
export function ErrorState({ message = 'Could not reach Fonzkart. Check your internet connection.', error, onRetry }: {
  message?: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <View style={[styles.badge, styles.errorBadge]}>
        <Icon name="refresh" color={colors.muted} size={32} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {error ? <Text style={styles.detail} selectable>{errorDetail(error)}</Text> : null}
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Try again" variant="secondary" icon="refresh" size="md" onPress={onRetry} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** A short technical reason: the error's name and message (e.g. "TypeError: Network request failed"). */
function errorDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 200);
  return String(error).slice(0, 200);
}

const useStyles = makeStyles(colors => ({
  detail: { ...type.small, fontSize: 11, color: colors.muted, textAlign: 'center', maxWidth: 320, opacity: 0.8 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: radii.md, padding: 14 },
  noticeText: { flex: 1, ...type.small, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8, minHeight: 240 },
  badge: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  errorBadge: { backgroundColor: colors.placeholder },
  title: { ...type.heading, color: colors.navy, textAlign: 'center' },
  message: { ...type.body, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: 12, minWidth: 200 },
}));

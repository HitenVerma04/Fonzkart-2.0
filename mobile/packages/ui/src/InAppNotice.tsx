// In-app notifications: when a new notification reaches the person's inbox while the app is open (the inbox refreshes
// every minute, on returning to the app, and at once when a phone notification arrives), a banner slides down from the
// top of the screen with its title and message. Tapping it opens what it is about; it hides itself after a few
// seconds, or with ✕. Notifications already in the inbox when the app opens are not announced again.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InboxItem } from './Inbox';
import { makeStyles } from './ThemeContext';
import { font, radius, spacing } from './theme';

const SHOW_MS = 6000;

/**
 * Announces new unread inbox items with a banner. `items` is the inbox (undefined while loading or signed out);
 * `onOpen` opens the item (and should mark it read). Render once, after the screens, inside the root layout.
 */
export function InAppNotifier({ items, onOpen }: { items: InboxItem[] | undefined; onOpen: (item: InboxItem) => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const seen = useRef<Set<string> | null>(null);
  const [current, setCurrent] = useState<{ item: InboxItem; more: number } | null>(null);
  const slide = useRef(new Animated.Value(-200)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Signed out (no inbox): forget, so the next person's old notifications are not announced either.
  useEffect(() => {
    if (!items) seen.current = null;
  }, [items]);

  useEffect(() => {
    if (!items) return;
    if (!seen.current) {
      seen.current = new Set(items.map(i => i.id)); // what was there when the app opened
      return;
    }
    const fresh = items.filter(i => !i.isRead && !seen.current!.has(i.id));
    items.forEach(i => seen.current!.add(i.id));
    if (!fresh.length) return;
    const newest = [...fresh].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
    setCurrent({ item: newest, more: fresh.length - 1 });
  }, [items]);

  useEffect(() => {
    if (!current) return;
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => hide(), SHOW_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const hide = () => {
    Animated.timing(slide, { toValue: -200, duration: 220, useNativeDriver: true }).start(() => setCurrent(null));
  };

  if (!current) return null;
  const { item, more } = current;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { paddingTop: insets.top + spacing.sm }]}>
      <Animated.View style={[styles.banner, { transform: [{ translateY: slide }] }]}>
        <Pressable style={styles.body} accessibilityRole="button" accessibilityLiveRegion="polite"
          accessibilityLabel={`New notification: ${item.title}. ${item.message}. Tap to open.`}
          onPress={() => {
            hide();
            onOpen(item);
          }}>
          <View style={styles.dot}><Text style={styles.bell}>🔔</Text></View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            {more > 0 ? <Text style={styles.more}>+{more} more in your inbox</Text> : null}
          </View>
        </Pressable>
        <Pressable onPress={hide} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss notification" style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md, zIndex: 1000, elevation: 1000 },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'center', width: '100%', maxWidth: 560,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.greenBorder,
    borderLeftWidth: 5, borderLeftColor: colors.green, paddingVertical: spacing.md, paddingLeft: spacing.md, paddingRight: spacing.sm,
    boxShadow: '0px 10px 28px rgba(6, 38, 21, 0.22)', elevation: 12,
  },
  body: { flex: 1, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  bell: { fontSize: 18 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: font.body, fontWeight: '800', color: colors.text },
  message: { fontSize: font.small, color: colors.textSoft },
  more: { fontSize: font.tiny, fontWeight: '700', color: colors.green, marginTop: 2 },
  close: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  closeText: { fontSize: font.body, color: colors.muted, fontWeight: '700' },
}));

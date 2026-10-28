// Cards, section headings, label/value rows and list items.
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { radii, type, useDesign } from './tokens';

export function Card({ title, icon, right, children, style }: {
  title?: string;
  icon?: IconName;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  return (
    <View style={[styles.card, { boxShadow: d.shadow.sm }, style]}>
      {title || right ? (
        <View style={styles.cardHead}>
          {icon ? (
            <View style={styles.cardIcon}>
              <Icon name={icon} color={colors.green} size={18} filled />
            </View>
          ) : null}
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right ? <View style={styles.cardRight}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; onPress: () => void } }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Tap onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action.label}</Text>
          <Icon name="chevronRight" color={colors.green} size={16} strokeWidth={2.4} />
        </Tap>
      ) : null}
    </View>
  );
}

export function InfoRow({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.info}>
      {icon ? <Icon name={icon} color={colors.muted} size={18} /> : null}
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} selectable>{value || '—'}</Text>
      </View>
    </View>
  );
}

/** A tappable row: picture or icon, title and subtitle, something on the right, and a chevron. */
export function ListItem({ leading, title, subtitle, trailing, onPress, highlighted, accessibilityLabel }: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  highlighted?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      style={[styles.item, { boxShadow: d.shadow.sm }, highlighted && styles.itemHighlighted]}
    >
      {leading}
      <View style={styles.itemText}>
        <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.itemSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevronRight" color={colors.muted} size={18} /> : null}
    </Tap>
  );
}

/** A round icon on a tinted disc (feature lists, settings rows). */
export function IconBadge({ name, size = 40 }: { name: IconName; size?: number }) {
  const colors = useColors();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} color={colors.greenDark} size={size * 0.5} filled />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.greenTint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, ...type.heading, fontSize: 17, color: colors.navy },
  cardRight: { marginLeft: 'auto' },
  section: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  sectionText: { flex: 1, gap: 2 },
  sectionTitle: { ...type.heading, color: colors.navy },
  sectionSubtitle: { ...type.small, color: colors.muted },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  sectionActionText: { ...type.small, fontWeight: '700', color: colors.green },
  info: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { ...type.small, fontSize: 12, color: colors.muted },
  infoValue: { ...type.body, fontWeight: '600', color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 64 },
  itemHighlighted: { borderColor: colors.greenBorder, backgroundColor: colors.greenSoft },
  itemText: { flex: 1, gap: 3 },
  itemTitle: { ...type.label, fontSize: 15, color: colors.text },
  itemSubtitle: { ...type.small, color: colors.muted },
}));

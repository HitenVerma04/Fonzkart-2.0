import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from './theme';

/** One answer in the device questionnaire: a radio (single choice) or a checkbox (several choices). */
export function ChoiceCard({ label, description, selected, multi, onPress }: {
  label: string;
  description?: string;
  selected: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => [styles.card, selected && styles.selected, pressed && !selected && styles.pressed]}
    >
      <View style={[multi ? styles.box : styles.radio, selected && styles.markOn]}>
        {selected ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

/** A yes/no question (tablet, watch, laptop... condition checks). */
export function YesNo({ question, detail, value, onChange }: {
  question: string;
  detail?: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.label}>{question}</Text>
      {detail ? <Text style={styles.description}>{detail}</Text> : null}
      <View style={styles.yesNoRow}>
        {([true, false] as const).map(answer => {
          const on = value === answer;
          return (
            <Pressable
              key={String(answer)}
              onPress={() => onChange(answer)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${question} ${answer ? 'Yes' : 'No'}`}
              style={[styles.yesNo, on && styles.selected]}
            >
              <Text style={[styles.yesNoText, on && styles.labelOn]}>{answer ? 'Yes' : 'No'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  selected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  pressed: { borderColor: colors.muted },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  markOn: { borderColor: colors.green, backgroundColor: colors.green },
  tick: { color: colors.white, fontSize: 13, fontWeight: '800' },
  text: { flex: 1 },
  label: { fontSize: font.body, fontWeight: '700', color: colors.text },
  labelOn: { color: colors.greenDark },
  description: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  question: { gap: spacing.xs },
  yesNoRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  yesNo: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  yesNoText: { fontSize: font.body, fontWeight: '700', color: colors.text },
});

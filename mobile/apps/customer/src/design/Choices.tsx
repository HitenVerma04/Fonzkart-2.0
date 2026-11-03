// Choosing things: answer cards for the device check (the website's questionnaire, as in @fonzkart/ui's
// QuestionStepView, which the Partner app keeps using), yes/no pairs, chips and a segmented control.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';
import { isMultiSelect, toggleOption, type Answers, type QuestionOption, type QuestionStep } from '@fonzkart/core';
import { makeStyles, useColors } from '@fonzkart/ui';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { motion, radii, systemFill, type, useDesign } from './tokens';

/** One answer. `compact`: a half-width tile (tick-all-that-apply lists without descriptions, two per row). */
export function ChoiceCard({ label, description, selected, multi, compact, onPress }: {
  label: string;
  description?: string;
  selected: boolean;
  multi?: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={[styles.card, compact && styles.cardCompact, selected && [styles.cardOn, { boxShadow: d.shadow.sm }]]}
    >
      <View style={[multi ? styles.box : styles.radio, selected && styles.markOn]}>
        {selected ? (
          <Animated.View entering={ZoomIn.duration(160)}>
            <Icon name="check" color={d.onGreen} size={14} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, compact && styles.labelCompact, selected && { color: colors.greenDark }]} numberOfLines={compact ? 2 : undefined}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Tap>
  );
}

export function YesNo({ question, detail, value, onChange }: {
  question: string;
  detail?: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.question}>
      <Text style={styles.label}>{question}</Text>
      {detail ? <Text style={styles.description}>{detail}</Text> : null}
      <View style={styles.yesNoRow}>
        {([true, false] as const).map(answer => (
          <Chip
            key={String(answer)}
            label={answer ? 'Yes' : 'No'}
            selected={value === answer}
            onPress={() => onChange(answer)}
            wide
            role="radio"
            accessibilityLabel={`${question} ${answer ? 'Yes' : 'No'}`}
          />
        ))}
      </View>
    </View>
  );
}

export function QuestionStepView({ step, answers, onChange }: {
  step: QuestionStep;
  answers: Answers;
  onChange: (key: string, value: Answers[string]) => void;
}) {
  const styles = useStyles();
  const choices = (key: string, kind: string | undefined, options: QuestionOption[] | undefined) => {
    const multi = isMultiSelect(kind);
    // Tick-all-that-apply lists of short labels (functional problems, accessories) read faster as a two-column grid.
    const compact = multi && (options ?? []).every(o => !o.description && o.label.length <= 28);
    const cards = (options ?? []).map(option => {
      const current = answers[key];
      const selected = multi ? Array.isArray(current) && current.includes(option.id) : current === option.id;
      return (
        <ChoiceCard
          key={option.id}
          label={option.label}
          description={option.description}
          multi={multi}
          compact={compact}
          selected={selected}
          onPress={() => onChange(key, multi ? toggleOption(current, option.id) : option.id)}
        />
      );
    });
    return compact ? <View style={styles.grid}>{cards}</View> : cards;
  };

  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>{step.title}</Text>
      {step.subtitle ? <Text style={styles.stepSubtitle}>{step.subtitle}</Text> : null}
      {isMultiSelect(step.type) ? <Text style={styles.multiHint}>Select all that apply, or none.</Text> : null}
      <View style={styles.options}>
        {step.questions?.map(q => (
          <YesNo
            key={q.id}
            question={q.text}
            detail={q.subtext}
            value={typeof answers[q.id] === 'boolean' ? (answers[q.id] as boolean) : undefined}
            onChange={value => onChange(q.id, value)}
          />
        ))}
        {step.type === 'combined-step'
          ? step.sections?.map(section => (
              <View key={section.id} style={styles.group}>
                <Text style={styles.groupTitle}>{section.title}</Text>
                {choices(section.id, section.type, section.options)}
              </View>
            ))
          : !step.questions && choices(step.id, step.type, step.options)}
      </View>
    </View>
  );
}

/** A selectable pill: a day, a time slot, yes or no. */
export function Chip({ label, caption, selected, wide, onPress, role = 'button', accessibilityLabel }: {
  label: string;
  caption?: string;
  selected: boolean;
  wide?: boolean;
  onPress: () => void;
  role?: 'button' | 'radio';
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.95}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      accessibilityLabel={accessibilityLabel ?? [label, caption].filter(Boolean).join(' ')}
      style={[styles.chip, { backgroundColor: d.scheme === 'dark' ? systemFill.dark : systemFill.light }, wide && styles.chipWide, selected && { backgroundColor: colors.green }]}
    >
      <Text style={[styles.chipLabel, selected && { color: d.onGreen }]}>{label}</Text>
      {caption ? <Text style={[styles.chipCaption, selected && { color: d.onGreen }]}>{caption}</Text> : null}
    </Tap>
  );
}

/** Two to four options in one glass track; the selection slides between them. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const colors = useColors();
  const d = useDesign();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const slot = width / options.length;
  const index = Math.max(0, options.findIndex(o => o.id === value));
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(index * slot, motion.snappy);
  }, [index, slot, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.track} onLayout={e => setWidth(e.nativeEvent.layout.width - 4)} accessibilityRole="radiogroup">
      {slot ? <Animated.View style={[styles.thumb, { width: slot }, thumb]} /> : null}
      {options.map(o => {
        const on = o.id === value;
        return (
          <Tap key={o.id} onPress={() => onChange(o.id)} scaleTo={0.95} accessibilityRole="radio" accessibilityState={{ checked: on }}
            accessibilityLabel={o.label} style={styles.segment}>
            {o.icon ? <Icon name={o.icon} color={on ? colors.green : colors.muted} size={16} filled={on} /> : null}
            <Text style={[styles.segmentText, on && { color: colors.navy }]}>{o.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, padding: 16 },
  cardOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  cardCompact: { flexBasis: '45%', flexGrow: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 10, minHeight: 56 },
  labelCompact: { fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  markOn: { borderColor: colors.green, backgroundColor: colors.green },
  text: { flex: 1, gap: 2 },
  label: { ...type.label, fontSize: 15, color: colors.text },
  description: { ...type.small, color: colors.muted },
  question: { gap: 4, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 16 },
  yesNoRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  step: { gap: 6 },
  stepTitle: { ...type.title, color: colors.navy },
  stepSubtitle: { ...type.body, color: colors.muted },
  multiHint: { ...type.small, color: colors.green, fontWeight: '600' },
  options: { gap: 10, marginTop: 14 },
  group: { gap: 10, marginBottom: 14 },
  groupTitle: { ...type.heading, fontSize: 16, color: colors.text },
  chip: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  chipWide: { flexGrow: 1, flexBasis: 0 },
  chipLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2, color: colors.text },
  chipCaption: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  // the iOS segmented control: gray track, white thumb with a soft shadow
  track: { flexDirection: 'row', backgroundColor: 'rgba(118,118,128,0.12)', borderRadius: 9, padding: 2 },
  thumb: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: 7, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.04)', boxShadow: '0px 3px 8px rgba(0,0,0,0.12), 0px 3px 1px rgba(0,0,0,0.04)' },
  segment: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 34 },
  segmentText: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: -0.1, color: colors.text },
}));

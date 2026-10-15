// One step of the website's device questionnaire, used by the customer's quote (Customer app) and the executive's
// re-check at pickup (Partner app), so both ask exactly the same questions in the same way.
import { StyleSheet, Text, View } from 'react-native';
import { isMultiSelect, toggleOption, type Answers, type QuestionOption, type QuestionStep } from '@fonzkart/core';
import { ChoiceCard, YesNo } from './ChoiceCard';
import { colors, font, spacing } from './theme';

export function QuestionStepView({ step, answers, onChange }: {
  step: QuestionStep;
  answers: Answers;
  onChange: (key: string, value: Answers[string]) => void;
}) {
  const choices = (key: string, type: string | undefined, options: QuestionOption[] | undefined) => {
    const multi = isMultiSelect(type);
    return (options ?? []).map(option => {
      const current = answers[key];
      const selected = multi ? Array.isArray(current) && current.includes(option.id) : current === option.id;
      return (
        <ChoiceCard
          key={option.id}
          label={option.label}
          description={option.description}
          multi={multi}
          selected={selected}
          onPress={() => onChange(key, multi ? toggleOption(current, option.id) : option.id)}
        />
      );
    });
  };

  return (
    <View style={styles.step}>
      <Text style={styles.title}>{step.title}</Text>
      {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
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
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {choices(section.id, section.type, section.options)}
              </View>
            ))
          : !step.questions && choices(step.id, step.type, step.options)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.sm },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: font.body, color: colors.muted },
  multiHint: { fontSize: font.small, color: colors.muted, fontStyle: 'italic' },
  options: { gap: spacing.md, marginTop: spacing.md },
  section: { gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
});

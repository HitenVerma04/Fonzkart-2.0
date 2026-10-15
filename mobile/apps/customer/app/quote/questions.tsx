import { useCallback, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuestionnaire } from '@fonzkart/api';
import { isMultiSelect, isStepComplete, stepsForDevice, toggleOption, type Answers, type QuestionOption } from '@fonzkart/core';
import { Button, ChoiceCard, EmptyState, ErrorState, Loading, RemoteImage, YesNo, colors, font, radius, spacing } from '@fonzkart/ui';
import { PAGE_PADDING } from '../../src/grid';
import { saveAnswers, useQuoteDraft } from '../../src/quoteDraft';

export default function Questions() {
  const router = useRouter();
  const draft = useQuoteDraft();
  const questionnaire = useQuestionnaire();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(() => draft?.answers ?? {});
  const scroll = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const steps = useMemo(
    () => (questionnaire.data && draft ? stepsForDevice(questionnaire.data, draft.category, draft.modelName) : []),
    [questionnaire.data, draft],
  );
  const step = steps[index];

  const goTo = (next: number) => {
    setIndex(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  // Android back button: previous question first, then leave the check.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (index === 0) return false;
        goTo(index - 1);
        return true;
      });
      return () => sub.remove();
    }, [index]),
  );

  if (!draft) return <EmptyState message="Choose a device first." />;
  if (questionnaire.isPending) return <Loading />;
  if (questionnaire.isError) return <ErrorState onRetry={() => questionnaire.refetch()} />;
  if (!step) return <EmptyState message="No questions for this device yet." />;

  const set = (key: string, value: Answers[string]) => setAnswers(prev => ({ ...prev, [key]: value }));
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
          onPress={() => set(key, multi ? toggleOption(current, option.id) : option.id)}
        />
      );
    });
  };

  const last = index === steps.length - 1;
  const next = () => {
    if (!last) return goTo(index + 1);
    saveAnswers(answers);
    router.push('/quote/offer');
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={styles.page}>
        <View style={styles.device}>
          <RemoteImage uri={draft.img} label={draft.modelName} size={48} />
          <View style={styles.deviceText}>
            <Text style={styles.deviceName}>{draft.modelName}</Text>
            <Text style={styles.variant}>{draft.variantName}</Text>
          </View>
        </View>

        <Text style={styles.progress}>Step {index + 1} of {steps.length}</Text>
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
              onChange={value => set(q.id, value)}
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        {index > 0 ? (
          <View style={styles.back}>
            <Button title="Back" variant="secondary" onPress={() => goTo(index - 1)} />
          </View>
        ) : null}
        <View style={styles.continue}>
          <Button title={last ? 'Get my price' : 'Continue'} onPress={next} disabled={!isStepComplete(step, answers)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.sm, maxWidth: 640, width: '100%', alignSelf: 'center' },
  device: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  deviceText: { flex: 1 },
  deviceName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  variant: { fontSize: font.small, color: colors.muted },
  progress: { fontSize: font.small, fontWeight: '700', color: colors.green },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: font.body, color: colors.muted },
  multiHint: { fontSize: font.small, color: colors.muted, fontStyle: 'italic' },
  options: { gap: spacing.md, marginTop: spacing.md },
  section: { gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  back: { flex: 1 },
  continue: { flex: 2 },
});

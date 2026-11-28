import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { usePriceSheet, useQuestionnaire } from '@fonzkart/api';
import { formatInr, isStepComplete, priceFromSheet, stepQuestionIds, stepsForDevice, withSkippedAnswers, type Answers } from '@fonzkart/core';
import { makeStyles } from '@fonzkart/ui';
import {
  ActionBar, Button, EmptyState, ErrorState, MAX_CONTENT, motion, PAGE_PADDING, ProductImage, deviceKindOf, QuestionStepView, radii,
  Skeleton, SkeletonScreen, type, useDesign,
} from '../../src/design';
import { saveAnswers, useQuoteDraft } from '../../src/quoteDraft';
import { recordSellStep } from '../../src/sellProgress';

export default function Questions() {
  const styles = useStyles();
  const d = useDesign();
  const router = useRouter();
  const draft = useQuoteDraft();
  const questionnaire = useQuestionnaire();
  // A check put back by "Pick up where you left off" opens on the question the customer had reached.
  const [index, setIndex] = useState(() => draft?.resume?.step ?? 0);
  const [answers, setAnswers] = useState<Answers>(() => draft?.answers ?? draft?.resume?.answers ?? {});
  const scroll = useRef<ScrollViewInstance>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);

  const steps = useMemo(
    () => (questionnaire.data && draft ? stepsForDevice(questionnaire.data, draft.category, draft.modelName) : []),
    [questionnaire.data, draft],
  );
  const step = steps[index];

  // The live price: the device's price sheet comes once, then every tick and untick is priced here at once. Only the
  // questions reached so far count, so accessories not asked about yet do not count as missing. Hidden if the sheet
  // cannot be had (offline): the offer screen still has the server's price.
  const sheet = usePriceSheet(draft?.modelName, draft?.variantName);
  const reached = useMemo(() => new Set(steps.slice(0, index + 1).flatMap(stepQuestionIds)), [steps, index]);
  const live = useMemo(() => (sheet.data ? priceFromSheet(sheet.data, answers, reached) : null), [sheet.data, answers, reached]);

  // Saved progress from an older questionnaire can point past its end: open its last question instead.
  useEffect(() => {
    if (steps.length && index >= steps.length) setIndex(steps.length - 1);
  }, [steps.length, index]);

  // Every answer and every move between questions is saved for "Pick up where you left off" on Home.
  useEffect(() => {
    if (!draft || !steps.length) return;
    const { answers: _done, resume: _old, ...device } = draft;
    recordSellStep({
      stage: 'questions', category: draft.category, modelId: draft.modelId, modelName: draft.modelName, img: draft.img,
      draft: { ...device, resume: { step: Math.min(index, steps.length - 1), answers } }, stepCount: steps.length,
    });
  }, [draft, steps.length, index, answers]);

  useEffect(() => {
    if (steps.length) progress.value = withSpring((index + 1) / steps.length, motion.gentle);
  }, [index, steps.length, progress]);
  // Slides along the track: animating its width would redo the layout on every frame.
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: -trackWidth * (1 - progress.value) }] }));

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

  if (!draft) return <EmptyState icon="auto" message="Choose a device first." />;
  if (questionnaire.isPending) {
    return (
      <SkeletonScreen label="Loading questions" style={styles.loading}>
        <Skeleton height={72} radius={radii.lg} />
        <Skeleton height={8} radius={4} />
        <Skeleton width="70%" height={26} />
        <Skeleton width="90%" height={14} />
        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={64} radius={radii.md} />)}
      </SkeletonScreen>
    );
  }
  if (questionnaire.isError) return <ErrorState error={questionnaire.error} onRetry={() => questionnaire.refetch()} />;
  if (!step) return <EmptyState icon="auto" message="No questions for this device yet." />;

  const set = (key: string, value: Answers[string]) => setAnswers(prev => ({ ...prev, [key]: value }));

  const last = index === steps.length - 1;
  const next = () => {
    if (!last) return goTo(index + 1);
    saveAnswers(withSkippedAnswers(steps, answers)); // a skipped device age is sent as out of warranty
    router.push('/quote/offer');
  };

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.device, { boxShadow: d.shadow.sm }]}>
          <View style={styles.deviceImage}>
            <ProductImage uri={draft.img} label={draft.modelName} size={48} kind={deviceKindOf(draft.category)} />
          </View>
          <View style={styles.deviceText}>
            <Text style={styles.deviceName} numberOfLines={2}>{draft.modelName}</Text>
            <Text style={styles.variant}>{draft.variantName}</Text>
          </View>
        </View>

        <View style={styles.progressBox} accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }}>
          <View style={styles.progressText}>
            <Text style={styles.progressLabel}>Step {index + 1} of {steps.length}</Text>
            <Text style={styles.progressPercent}>{Math.round(((index + 1) / steps.length) * 100)}%</Text>
          </View>
          <View style={styles.track} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.fill, { backgroundImage: d.greenGradient }, fill]} />
          </View>
        </View>

        {live && sheet.data && sheet.data.maxValue > 0 ? (
          <View style={styles.live} accessibilityLiveRegion="polite" accessibilityLabel={`Estimated price ${formatInr(live.price)}`}>
            <View style={styles.liveText}>
              <Text style={styles.liveLabel}>Estimated price</Text>
              <Text style={styles.liveHint}>
                {live.price < sheet.data.maxValue
                  ? `${formatInr(sheet.data.maxValue - live.price)} off the max value`
                  : 'Nothing taken off yet'}
              </Text>
            </View>
            <Animated.Text key={live.price} entering={FadeIn.duration(220)} style={styles.livePrice}>{formatInr(live.price)}</Animated.Text>
          </View>
        ) : null}

        <Animated.View key={step.id} entering={FadeIn.duration(260)}>
          <QuestionStepView step={step} answers={answers} onChange={set} />
        </Animated.View>
      </ScrollView>

      <ActionBar>
        {index > 0 ? (
          <View style={styles.back}>
            <Button title="Back" variant="outline" onPress={() => goTo(index - 1)} />
          </View>
        ) : null}
        <View style={styles.continue}>
          <Button title={last ? 'Get my price' : 'Continue'} icon={last ? 'sparkle' : undefined} onPress={next}
            disabled={!isStepComplete(step, answers)} />
        </View>
      </ActionBar>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { padding: PAGE_PADDING, gap: 14 },
  page: { padding: PAGE_PADDING, paddingBottom: 32, gap: 16, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  deviceImage: { width: 60, height: 60, borderRadius: radii.sm, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  deviceText: { flex: 1, gap: 2 },
  deviceName: { ...type.label, fontSize: 16, color: colors.navy },
  variant: { ...type.small, color: colors.muted },
  progressBox: { gap: 8 },
  progressText: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...type.small, fontWeight: '700', color: colors.green },
  progressPercent: { ...type.small, fontWeight: '700', color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.placeholder, overflow: 'hidden' },
  fill: { width: '100%', height: 8, borderRadius: 4 },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenTint, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 14,
  },
  liveText: { flex: 1, gap: 2 },
  liveLabel: { ...type.small, fontWeight: '700', color: colors.navy },
  liveHint: { ...type.tiny, color: colors.muted },
  livePrice: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.green, fontVariant: ['tabular-nums'] },
  back: { flex: 1 },
  continue: { flex: 2 },
}));

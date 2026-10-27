// Edit carousel view: the cards of the Customer app's home-page carousel (under "Choose a category"). Add, edit
// (picture, title, text, the category a card opens), show or hide, move up/down, delete. The Customer app reads the
// same cards from the backend, so a change shows there within a minute or when the app is reopened.
import { useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { carouselApi, contentKeys, useCarouselAdmin, type CarouselSlide, type CarouselSlideInput } from '@fonzkart/api';
import { SELL_CATEGORIES, categoryName, imageUrl } from '@fonzkart/core';
import { Button, Card, EmptyState, ErrorState, ListPicker, Loading, Notice, TextField, colors, font, radius, spacing } from '@fonzkart/ui';
import { ImageField } from '../src/ImageField';

const MAX_TITLE = 60;
const MAX_TEXT = 120;
const EMPTY: CarouselSlideInput = { imageUrl: '', title: '', subtitle: '', category: null, isActive: true };

export default function CarouselEditor() {
  const client = useQueryClient();
  const slides = useCarouselAdmin();
  const [editing, setEditing] = useState<CarouselSlide | 'new' | null>(null);
  const [form, setForm] = useState<CarouselSlideInput>(EMPTY);
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (slides.isPending) return <Loading />;
  if (slides.isError) return <ErrorState onRetry={() => slides.refetch()} />;
  const list = slides.data;

  const open = (s: CarouselSlide | 'new') => {
    setEditing(s);
    setMessage(null);
    setDeleting(null);
    setForm(s === 'new' ? EMPTY : { imageUrl: s.imageUrl, title: s.title, subtitle: s.subtitle, category: s.category, isActive: s.isActive });
  };
  const run = async (task: () => Promise<{ error?: string }>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await task();
      if (r.error) setMessage({ tone: 'error', text: r.error });
      else {
        setMessage({ tone: 'success', text: done });
        setEditing(null);
        setDeleting(null);
        await client.invalidateQueries({ queryKey: contentKeys.carouselAdmin });
        await client.invalidateQueries({ queryKey: contentKeys.carousel });
      }
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const input = { ...form, imageUrl: form.imageUrl.trim(), title: form.title.trim(), subtitle: form.subtitle.trim() };
    if (editing === 'new') void run(() => carouselApi.add(input), `"${input.title}" added.`);
    else if (editing) void run(() => carouselApi.update(editing.id, input), `"${input.title}" saved.`);
  };

  // Move a card one place: every card gets its new position (0, 1, 2…), in one request.
  const move = (index: number, by: -1 | 1) => {
    const other = index + by;
    if (other < 0 || other >= list.length) return;
    const order = [...list];
    [order[index], order[other]] = [order[other]!, order[index]!];
    void run(() => carouselApi.reorder(order.map((s, i) => ({ id: s.id, displayOrder: i }))), `"${list[index]!.title}" moved.`);
  };

  const toggle = (s: CarouselSlide) => {
    const input = { imageUrl: s.imageUrl, title: s.title, subtitle: s.subtitle, category: s.category, isActive: !s.isActive };
    void run(() => carouselApi.update(s.id, input), `"${s.title}" ${input.isActive ? 'shown in the app' : 'hidden'}.`);
  };

  const remove = (s: CarouselSlide) => {
    if (deleting !== s.id) {
      setDeleting(s.id);
      return;
    }
    void run(() => carouselApi.remove(s.id), `"${s.title}" deleted.`);
  };

  const canSave = !!form.imageUrl.trim() && !!form.title.trim() && form.title.trim().length <= MAX_TITLE
    && form.subtitle.trim().length <= MAX_TEXT;

  return (
    <>
      <FlatList
        data={list}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={slides.isRefetching} onRefresh={() => void slides.refetch()} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.muted}>
              The cards customers swipe through under "Choose a category" on the Customer app's home screen, in this order.
              Hidden cards stay here but are not shown.
            </Text>
            {message ? <Notice tone={message.tone} text={message.text} /> : null}
            {editing ? (
              <Card title={editing === 'new' ? 'New card' : 'Edit card'}>
                <ImageField label="Picture (wide, about 16:9)" value={form.imageUrl} onChange={imageUrl => setForm(f => ({ ...f, imageUrl }))} />
                {form.imageUrl.trim() ? <Preview slide={form} /> : null}
                <TextField label="Title" value={form.title} maxLength={MAX_TITLE} hint={`${form.title.length}/${MAX_TITLE}`}
                  onChangeText={title => setForm(f => ({ ...f, title }))} />
                <TextField label="Text (optional)" value={form.subtitle} maxLength={MAX_TEXT} hint={`${form.subtitle.length}/${MAX_TEXT}`}
                  onChangeText={subtitle => setForm(f => ({ ...f, subtitle }))} multiline />
                <Button title={`Opens: ${form.category ? categoryName(form.category) ?? form.category : 'nothing (no tap)'}`}
                  variant="secondary" onPress={() => setPicking(true)} />
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Show in the app</Text>
                  <Switch value={form.isActive} trackColor={{ true: colors.green }} onValueChange={isActive => setForm(f => ({ ...f, isActive }))}
                    accessibilityLabel="Show in the app" />
                </View>
                <View style={styles.row}>
                  <View style={styles.flex}><Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} /></View>
                  <View style={styles.flex}><Button title="Save" loading={busy} disabled={!canSave} onPress={save} /></View>
                </View>
              </Card>
            ) : <Button title="Add a card" onPress={() => open('new')} />}
          </View>
        }
        ListEmptyComponent={<EmptyState message="No cards yet. The carousel is hidden in the app until you add one." />}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, !item.isActive && styles.hidden]}>
            <Thumb uri={item.imageUrl} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.muted} numberOfLines={2}>{item.subtitle}</Text> : null}
              <Text style={styles.muted}>
                {item.category ? `Opens ${categoryName(item.category) ?? item.category}` : 'No tap'}{item.isActive ? '' : ' · Hidden'}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button title="↑" variant="link" disabled={index === 0 || busy} onPress={() => move(index, -1)} />
              <Button title="↓" variant="link" disabled={index === list.length - 1 || busy} onPress={() => move(index, 1)} />
              <Button title="Edit" variant="link" onPress={() => open(item)} />
              <Button title={item.isActive ? 'Hide' : 'Show'} variant="link" disabled={busy} onPress={() => toggle(item)} />
              <Button title={deleting === item.id ? 'Tap again to delete' : 'Delete'} variant="link" disabled={busy} onPress={() => remove(item)} />
            </View>
          </View>
        )}
      />
      <ListPicker
        visible={picking}
        title="The card opens"
        items={[{ id: '', name: 'Nothing (no tap)' }, ...SELL_CATEGORIES]}
        keyOf={c => c.id || 'none'}
        labelOf={c => c.name}
        onClose={() => setPicking(false)}
        onPick={c => {
          setPicking(false);
          setForm(f => ({ ...f, category: c.id || null }));
        }}
      />
    </>
  );
}

function Thumb({ uri }: { uri: string }) {
  const url = imageUrl(uri);
  return url ? <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />;
}

/** Roughly how the card looks in the Customer app. */
function Preview({ slide }: { slide: CarouselSlideInput }) {
  const url = imageUrl(slide.imageUrl);
  return (
    <View style={styles.preview}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={styles.previewShade} />
      <View style={styles.previewText}>
        <Text style={styles.previewTitle} numberOfLines={1}>{slide.title || 'Title'}</Text>
        {slide.subtitle ? <Text style={styles.previewSubtitle} numberOfLines={2}>{slide.subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, maxWidth: 900, width: '100%', alignSelf: 'center', flexGrow: 1 },
  head: { gap: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  label: { flex: 1, fontSize: font.body, fontWeight: '600', color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  slide: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  hidden: { opacity: 0.6 },
  thumb: { width: 96, height: 54, borderRadius: radius.sm, backgroundColor: colors.placeholder },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.navy, justifyContent: 'flex-end' },
  previewShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  previewText: { padding: spacing.md, gap: 2 },
  previewTitle: { fontSize: font.heading, fontWeight: '800', color: colors.white },
  previewSubtitle: { fontSize: font.small, color: colors.white, opacity: 0.9 },
});

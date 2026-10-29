// Bulk orders (the website's "Bulk Orders" card → contact page with the bulk topic): what Fonzkart offers businesses,
// and one tap to call, WhatsApp or email the team with the website's ready-made enquiry. Nothing is sent by the app.
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { makeStyles } from '@fonzkart/ui';
import { CATEGORY_ART } from '../src/categoryArt/art';
import { BULK_MESSAGE, CONTACT } from '../src/contact';
import { useTileWidth } from '../src/grid';
import { Appear, Button, Card, IconBadge, Notice, Page, radii, type, useDesign, type IconName } from '../src/design';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'building', title: 'Corporate IT assets', text: 'Laptops, phones and desktops from offices and institutions.' },
  { icon: 'lock', title: 'Certified data sanitization', text: 'Every device is wiped before it is resold or recycled.' },
  { icon: 'truck', title: 'Doorstep logistics', text: 'We collect from your premises, in any quantity.' },
  { icon: 'sparkle', title: 'Eco-friendly recycling', text: 'E-waste is recycled responsibly.' },
];

export default function BulkOrders() {
  const styles = useStyles();
  const d = useDesign();
  const width = useTileWidth(1);
  const [error, setError] = useState('');
  const Art = CATEGORY_ART.bulk;
  const artHeight = Math.round(width * 0.55);

  const open = (url: string) => {
    setError('');
    Linking.openURL(url).catch(() => setError('This phone has no app for that. Use the details below instead.'));
  };
  const subject = encodeURIComponent('Bulk selling enquiry');
  const body = encodeURIComponent(BULK_MESSAGE);

  return (
    <Page>
      <Appear>
        <View style={[styles.hero, { boxShadow: d.shadow.md }]}>
          <View style={[styles.art, { height: artHeight }]}>
            <Art width={width} height={artHeight} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>Corporate & recycling</Text>
            <Text style={styles.title}>Bulk orders</Text>
            <Text style={styles.text}>
              Looking to liquidate corporate IT assets, bulk gadgets, or recycle e-waste responsibly? Get custom pricing and
              doorstep logistics.
            </Text>
          </View>
        </View>
      </Appear>

      <Appear index={1}>
        <Card title="What we offer" icon="box">
          {FEATURES.map(f => (
            <View key={f.title} style={styles.feature}>
              <IconBadge name={f.icon} size={40} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.text}</Text>
              </View>
            </View>
          ))}
        </Card>
      </Appear>

      <Appear index={2} style={styles.actions}>
        {error ? <Notice tone="error" text={error} /> : null}
        <Button title={`Call ${CONTACT.phoneDisplay}`} icon="phone" onPress={() => open(`tel:${CONTACT.phone}`)} />
        <Button title="WhatsApp us" variant="secondary" icon="chat" onPress={() => open(`https://wa.me/${CONTACT.whatsapp}?text=${body}`)} />
        <Button title={`Email ${CONTACT.email}`} variant="secondary" icon="mail" onPress={() => open(`mailto:${CONTACT.email}?subject=${subject}&body=${body}`)} />
        <Text style={styles.hours}>Phone & WhatsApp: {CONTACT.hours}</Text>
      </Appear>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  hero: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  art: { backgroundColor: colors.greenSoft },
  heroText: { padding: 18, gap: 6 },
  kicker: { ...type.tiny, textTransform: 'uppercase', color: colors.green },
  title: { ...type.title, color: colors.navy },
  text: { ...type.body, color: colors.textSoft },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { ...type.label, color: colors.navy },
  featureBody: { ...type.small, color: colors.muted },
  actions: { gap: 10 },
  hours: { ...type.small, color: colors.muted, textAlign: 'center' },
}));

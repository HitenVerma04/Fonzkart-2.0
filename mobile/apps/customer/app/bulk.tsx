// Bulk orders (the website's "Bulk Orders" card → contact page with the bulk topic): what Fonzkart offers businesses,
// and one tap to call, WhatsApp or email the team with the website's ready-made enquiry. Nothing is sent by the app.
import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Button, font, makeStyles, Notice, radius, spacing } from '@fonzkart/ui';
import { CATEGORY_ART } from '../src/categoryArt/graphics';
import { BULK_MESSAGE, CONTACT } from '../src/contact';
import { PAGE_PADDING, useTileWidth } from '../src/grid';

export default function BulkOrders() {
  const styles = useStyles();
  const width = useTileWidth(1);
  const [error, setError] = useState('');
  const Art = CATEGORY_ART.bulk;

  const open = (url: string) => {
    setError('');
    Linking.openURL(url).catch(() => setError('This phone has no app for that. Use the details below instead.'));
  };
  const subject = encodeURIComponent('Bulk selling enquiry');
  const body = encodeURIComponent(BULK_MESSAGE);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={[styles.art, { height: Math.round(width * 0.6) }]}>
        <Art width={width} height={Math.round(width * 0.6)} />
      </View>
      <Text style={styles.kicker}>Corporate & recycling</Text>
      <Text style={styles.title}>Bulk orders</Text>
      <Text style={styles.text}>
        Looking to liquidate corporate IT assets, bulk gadgets, or recycle e-waste responsibly? Get custom pricing and
        doorstep logistics.
      </Text>
      <Text style={styles.text}>
        We help businesses, institutions and bulk sellers monetize old electronics with certified data sanitization and
        eco-friendly recycling.
      </Text>

      {error ? <Notice tone="error" text={error} /> : null}
      <Button title={`Call ${CONTACT.phoneDisplay}`} onPress={() => open(`tel:${CONTACT.phone}`)} />
      <Button title="WhatsApp us" variant="secondary" onPress={() => open(`https://wa.me/${CONTACT.whatsapp}?text=${body}`)} />
      <Button title={`Email ${CONTACT.email}`} variant="secondary" onPress={() => open(`mailto:${CONTACT.email}?subject=${subject}&body=${body}`)} />
      <Text style={styles.hours}>Phone & WhatsApp: {CONTACT.hours}</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles(colors => ({
  page: { padding: PAGE_PADDING, paddingBottom: spacing.xxl, gap: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  art: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.greenSoft },
  kicker: { fontSize: font.tiny, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.green },
  title: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  text: { fontSize: font.body, color: colors.textSoft, lineHeight: 22 },
  hours: { fontSize: font.small, color: colors.muted, textAlign: 'center' },
}));

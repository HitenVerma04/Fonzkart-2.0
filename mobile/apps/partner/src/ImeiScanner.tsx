// Reads an IMEI from the barcode on the phone's box or its "Settings → About" screen (expo-camera). IMEIs are 15
// digits; other barcodes on the label are ignored.
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, colors, font, spacing } from '@fonzkart/ui';

export function ImeiScanner({ visible, onScanned, onClose }: {
  visible: boolean;
  onScanned: (imei: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [last, setLast] = useState('');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={[styles.text, styles.light]}>Allow the camera to scan the IMEI barcode.</Text>
            <Button title="Allow camera" onPress={() => void requestPermission()} />
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'qr', 'datamatrix'] }}
            onBarcodeScanned={({ data }) => {
              const digits = (data.match(/\d{15}/) ?? [])[0];
              if (digits) onScanned(digits);
              else setLast(data);
            }}
          />
        )}
        <View style={styles.footer}>
          <Text style={styles.text}>{last ? `Not an IMEI: ${last.slice(0, 40)}` : 'Point at the IMEI barcode (15 digits).'}</Text>
          <Button title="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  footer: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface },
  text: { fontSize: font.body, color: colors.text, textAlign: 'center' },
  light: { color: colors.white },
});

// A refurbished device's condition grade.
import { Text, View } from 'react-native';
import { DEVICE_GRADES, type DeviceGrade } from '@fonzkart/api';
import { makeStyles, useColors } from '@fonzkart/ui';
import { radii, type } from '../design';

export function GradeBadge({ grade }: { grade: DeviceGrade }) {
  const styles = useStyles();
  const colors = useColors();
  const tone = grade === 'superb' ? colors.tones.green : grade === 'good' ? colors.tones.blue : colors.tones.gray;
  const label = DEVICE_GRADES.find(g => g.id === grade)?.label ?? grade;
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  badge: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
  text: { ...type.tiny, fontSize: 10.5, textTransform: 'uppercase' },
}));

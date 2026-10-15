import { useLocalSearchParams, useRouter } from 'expo-router';
import { StaffOrderDetail } from '@fonzkart/staff';

export default function PartnerOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <StaffOrderDetail orderId={id} onDeleted={() => router.back()} />;
}

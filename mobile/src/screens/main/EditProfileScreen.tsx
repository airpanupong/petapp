import React, {useState} from 'react';
import {Alert, StyleSheet} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {updateMe} from '../../api/users.api';
import {getApiErrorMessage} from '../../api/client';
import {useAuthStore} from '../../store/authStore';
import {spacing} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({navigation}: Props) {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [name, setName] = useState(user?.display_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return Alert.alert('กรอกชื่อที่แสดง');
    setSaving(true);
    try {
      const updated = await updateMe({
        display_name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setUser(updated);
      Alert.alert('บันทึกแล้ว', undefined, [{text: 'ตกลง', onPress: () => navigation.goBack()}]);
    } catch (e) {
      Alert.alert('บันทึกไม่สำเร็จ', getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppInput label="ชื่อที่แสดง *" value={name} onChangeText={setName} />
      <AppInput label="อีเมล" value={user?.email || ''} editable={false} />
      <AppInput label="เบอร์โทร" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <AppButton title="บันทึกโปรไฟล์" onPress={() => void save()} loading={saving} style={styles.btn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  btn: {marginTop: spacing.sm},
});

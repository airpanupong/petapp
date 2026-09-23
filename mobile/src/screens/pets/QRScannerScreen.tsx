import React, {useEffect, useRef, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {Camera, useCameraDevice, useCameraPermission, useCodeScanner} from 'react-native-vision-camera';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {getPublicPetByQr} from '../../api/pets.api';
import {Screen} from '../../components/Screen';
import {AppButton} from '../../components/AppButton';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'QRScanner'>;

export function QRScannerScreen({navigation}: Props) {
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const locked = useRef(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const scanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      const value = codes[0]?.value;
      if (!value || locked.current) return;
      locked.current = true;
      setActive(false);
      const token = value.split('/').filter(Boolean).pop() || value;
      void getPublicPetByQr(token)
        .then(() => {
          navigation.replace('PublicPet', {qrToken: token});
        })
        .catch(() => {
          Alert.alert('ไม่พบ Pet ID', 'QR นี้ไม่ใช่ Pet ID ที่ใช้งานได้', [{text: 'สแกนอีกครั้ง', onPress: () => {locked.current = false; setActive(true);}}]);
        });
    },
  });

  if (!hasPermission) {
    return <Screen contentStyle={styles.center}><Text style={styles.title}>ต้องอนุญาตกล้องเพื่อสแกน QR</Text><AppButton title="อนุญาตกล้อง" onPress={() => void requestPermission()} /></Screen>;
  }
  if (!device) return <Screen><Text>ไม่พบกล้อง</Text></Screen>;

  return (
    <View style={styles.full}>
      <Camera style={StyleSheet.absoluteFillObject} device={device} isActive={active} codeScanner={scanner} />
      <View style={styles.overlay}>
        <Text style={styles.scanTitle}>สแกน Pet QR</Text>
        <View style={styles.frame} />
        <Text style={styles.scanText}>วาง QR ให้อยู่ในกรอบ</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {flex: 1, backgroundColor: '#000'},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', gap: spacing.lg},
  frame: {width: 250, height: 250, borderWidth: 4, borderColor: colors.accent, borderRadius: radius.lg},
  scanTitle: {fontSize: typography.h1, color: '#fff', fontWeight: '900'},
  scanText: {color: '#fff', fontSize: typography.body, fontWeight: '700'},
  center: {flexGrow: 1, justifyContent: 'center'},
  title: {fontSize: typography.h3, fontWeight: '800', color: colors.text, textAlign: 'center'},
});

import React from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchCamera, launchImageLibrary, Asset} from 'react-native-image-picker';

import {AppIcon} from './AppIcon';
import {LocalImage} from '../api/uploads.api';
import {useI18n} from '../i18n/useI18n';
import {colors, radius, shadow, spacing, typography} from '../theme';

type Props = {
  images: LocalImage[];
  onChange: (images: LocalImage[]) => void;
  max?: number;
  label?: string;
};

function assetToLocal(asset: Asset): LocalImage | null {
  if (!asset.uri) return null;
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    type: asset.type,
    fileSize: asset.fileSize,
  };
}

export function PhotoPicker({images, onChange, max = 1, label}: Props) {
  const t = useI18n(s => s.t);

  const addAssets = (assets?: Asset[]) => {
    if (!assets?.length) return;
    const next = [...images];
    for (const asset of assets) {
      if (next.length >= max) break;
      const local = assetToLocal(asset);
      if (local) next.push(local);
    }
    onChange(next);
  };

  const openLibrary = () => {
    void launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: Math.max(1, max - images.length),
        quality: 0.8,
      },
      response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert(t('photoError'), response.errorMessage || t('photoPermission'));
          return;
        }
        addAssets(response.assets);
      },
    );
  };

  const openCamera = () => {
    void launchCamera(
      {
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.8,
        saveToPhotos: false,
      },
      response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert(t('photoError'), response.errorMessage || t('photoPermission'));
          return;
        }
        addAssets(response.assets);
      },
    );
  };

  const pick = () => {
    if (images.length >= max) {
      Alert.alert(t('photoLimit'), t('photoLimitDesc').replace('{max}', String(max)));
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('cancel'), t('takePhoto'), t('choosePhoto')],
          cancelButtonIndex: 0,
        },
        index => {
          if (index === 1) openCamera();
          if (index === 2) openLibrary();
        },
      );
      return;
    }
    Alert.alert(t('addPhotos'), undefined, [
      {text: t('takePhoto'), onPress: openCamera},
      {text: t('choosePhoto'), onPress: openLibrary},
      {text: t('cancel'), style: 'cancel'},
    ]);
  };

  const removeAt = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label ?? t('addPhotos')}</Text>
      <Text style={styles.hint}>
        {t('photoHint').replace('{max}', String(max))} ({images.length}/{max})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {images.map((img, index) => (
          <View key={`${img.uri}-${index}`} style={styles.thumbWrap}>
            <Image source={{uri: img.uri}} style={styles.thumb} />
            <Pressable style={styles.remove} onPress={() => removeAt(index)} hitSlop={8}>
              <AppIcon name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {images.length < max && (
          <Pressable style={styles.add} onPress={pick}>
            <AppIcon name="camera-outline" size={26} color={colors.primaryDark} />
            <Text style={styles.addText}>{t('addPhoto')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: spacing.xs},
  label: {fontSize: typography.small, fontWeight: '800', color: colors.text},
  hint: {fontSize: typography.caption, color: colors.textSecondary},
  row: {gap: 10, paddingVertical: 4},
  thumbWrap: {position: 'relative'},
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...shadow.soft,
  },
  addText: {fontSize: 11, fontWeight: '800', color: colors.primaryDark},
});

import React from 'react';
import {StyleProp, TextStyle} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {colors} from '../theme';

type IconSet = 'ion' | 'mci';

type Props = {
  name: string;
  size?: number;
  color?: string;
  set?: IconSet;
  style?: StyleProp<TextStyle>;
};

export function AppIcon({name, size = 22, color = colors.text, set = 'ion', style}: Props) {
  if (set === 'mci') {
    return <MaterialCommunityIcons name={name as never} size={size} color={color} style={style} />;
  }
  return <Ionicons name={name as never} size={size} color={color} style={style} />;
}

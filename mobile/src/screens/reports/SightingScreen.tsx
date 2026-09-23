import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {RootStackParamList} from '../../navigation/types';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {createSighting} from '../../api/community.api';
import {getCurrentCoordinates} from '../../services/location';
import {getApiErrorMessage} from '../../api/client';
import {colors, radius, spacing, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Sighting'>;

export function SightingScreen({route, navigation}: Props) {
  const qc=useQueryClient();
  const [lat,setLat]=useState(''); const [lng,setLng]=useState('');
  const [locationText,setLocationText]=useState(''); const [direction,setDirection]=useState(''); const [description,setDescription]=useState(''); const [locating,setLocating]=useState(false);
  const mutation=useMutation({mutationFn:(payload:Parameters<typeof createSighting>[1])=>createSighting(route.params.lostPostId,payload),onSuccess:()=>{void qc.invalidateQueries({queryKey:['lost-posts']});Alert.alert('ส่งเบาะแสแล้ว','ข้อมูลตำแหน่งนี้ถูกเพิ่มในเคสแล้ว',[{text:'ตกลง',onPress:()=>navigation.goBack()}]);},onError:e=>Alert.alert('ส่งไม่สำเร็จ',getApiErrorMessage(e))});
  const locate=async()=>{setLocating(true);try{const c=await getCurrentCoordinates();setLat(String(c.latitude));setLng(String(c.longitude));}catch(e){Alert.alert('ตำแหน่ง',e instanceof Error?e.message:'ไม่สามารถดึงตำแหน่ง');}finally{setLocating(false);}};
  const submit=()=>{const latitude=Number(lat),longitude=Number(lng);if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return Alert.alert('กรุณาระบุตำแหน่งที่เห็น');mutation.mutate({seen_at:new Date().toISOString(),latitude,longitude,location_text:locationText.trim()||undefined,direction:direction.trim()||undefined,description:description.trim()||undefined});};
  return <Screen>
    <View style={styles.box}><Text style={styles.title}>👀 ฉันเห็นสัตว์ตัวนี้</Text><Text style={styles.text}>เบาะแสเล็กๆ เช่น เวลา ทิศทาง และตำแหน่ง ช่วยเจ้าของตามหาได้มาก</Text></View>
    <AppButton title="📍 ใช้ตำแหน่งปัจจุบัน" variant="outline" loading={locating} onPress={()=>void locate()} />
    <View style={styles.row}><View style={{flex:1}}><AppInput label="Latitude *" value={lat} onChangeText={setLat} keyboardType="numeric" /></View><View style={{flex:1}}><AppInput label="Longitude *" value={lng} onChangeText={setLng} keyboardType="numeric" /></View></View>
    <AppInput label="ชื่อพื้นที่" value={locationText} onChangeText={setLocationText}/><AppInput label="ทิศทางที่ไป" value={direction} onChangeText={setDirection} placeholder="เช่น มุ่งหน้าไปทางเหนือ"/><AppInput label="รายละเอียด" value={description} onChangeText={setDescription} multiline style={{minHeight:100,textAlignVertical:'top'}}/><AppButton title="ส่งเบาะแส" onPress={submit} loading={mutation.isPending}/>
  </Screen>;
}
const styles=StyleSheet.create({box:{backgroundColor:'#FFF4DC',borderRadius:radius.lg,padding:spacing.md,gap:6},title:{fontSize:typography.h3,fontWeight:'900',color:colors.text},text:{fontSize:typography.small,color:colors.textSecondary,lineHeight:20},row:{flexDirection:'row',gap:spacing.sm}});

import React, {useEffect, useState} from 'react';
import {Alert, StyleSheet, Text} from 'react-native';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';
import {getPet, updatePet} from '../../api/pets.api';
import {Screen} from '../../components/Screen';
import {AppInput} from '../../components/AppInput';
import {AppButton} from '../../components/AppButton';
import {getApiErrorMessage} from '../../api/client';
import {colors, typography} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditPet'>;
export function EditPetScreen({route, navigation}: Props) {
  const qc=useQueryClient(); const q=useQuery({queryKey:['pet',route.params.petId],queryFn:()=>getPet(route.params.petId)});
  const [name,setName]=useState(''); const [breed,setBreed]=useState(''); const [color,setColor]=useState(''); const [gender,setGender]=useState(''); const [marks,setMarks]=useState(''); const [microchip,setMicrochip]=useState(''); const [description,setDescription]=useState('');
  useEffect(()=>{if(q.data){setName(q.data.name);setBreed(q.data.breed||'');setColor(q.data.color||'');setGender(q.data.gender||'');setMarks(q.data.distinctive_marks||'');setMicrochip(q.data.microchip_id||'');setDescription(q.data.description||'');}},[q.data]);
  const mutation=useMutation({mutationFn:()=>updatePet(route.params.petId,{name:name.trim(),breed:breed.trim()||undefined,color:color.trim()||undefined,gender:gender.trim()||undefined,distinctive_marks:marks.trim()||undefined,microchip_id:microchip.trim()||undefined,description:description.trim()||undefined}),onSuccess:()=>{void qc.invalidateQueries({queryKey:['pet',route.params.petId]});void qc.invalidateQueries({queryKey:['pets']});Alert.alert('บันทึกแล้ว','ข้อมูลสัตว์เลี้ยงถูกอัปเดต',[{text:'ตกลง',onPress:()=>navigation.goBack()}]);},onError:e=>Alert.alert('บันทึกไม่สำเร็จ',getApiErrorMessage(e))});
  if(!q.data)return <Screen><Text style={styles.muted}>กำลังโหลด...</Text></Screen>;
  return <Screen>
    <Text style={styles.title}>แก้ไขข้อมูล {q.data.name}</Text>
    <AppInput label="ชื่อ *" value={name} onChangeText={setName}/><AppInput label="สายพันธุ์" value={breed} onChangeText={setBreed}/><AppInput label="สี / ลาย" value={color} onChangeText={setColor}/><AppInput label="เพศ" value={gender} onChangeText={setGender}/><AppInput label="ตำหนิ / ลักษณะเฉพาะ" value={marks} onChangeText={setMarks} multiline style={{minHeight:80,textAlignVertical:'top'}}/><AppInput label="Microchip ID" value={microchip} onChangeText={setMicrochip}/><AppInput label="รายละเอียด" value={description} onChangeText={setDescription} multiline style={{minHeight:100,textAlignVertical:'top'}}/>
    <AppButton title="บันทึกข้อมูล" onPress={()=>mutation.mutate()} loading={mutation.isPending} disabled={!name.trim()}/>
  </Screen>;
}
const styles=StyleSheet.create({title:{fontSize:typography.h2,fontWeight:'900',color:colors.text},muted:{color:colors.textSecondary}});

import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Plus} from 'lucide-react';

import {listPets} from '../api/pets.api';
import {CatLoader} from '../components/CatLoader';
import {PetCard} from '../components/PostCards';
import {EmptyState, PageTitle} from '../components/ui';

export default function PetsPage() {
  const pets = useQuery({queryKey: ['pets'], queryFn: listPets});

  return (
    <div className="page">
      <PageTitle
        title="น้องของฉัน"
        subtitle="Pet Haii และข้อมูลที่ช่วยพาน้องกลับบ้าน"
        action={
          <Link to="/pets/new" className="btn btn-primary">
            <Plus size={18} /> เพิ่มน้อง
          </Link>
        }
      />
      {pets.isLoading ? (
        <CatLoader label="กำลังเรียกน้อง ๆ มาเข้าแถว" />
      ) : pets.data?.length ? (
        <div className="grid grid-3 grid-4">
          {pets.data.map(p => (
            <PetCard key={p.id} pet={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          animal="dog"
          title="ยังไม่มีน้องเลย"
          description="เพิ่มน้องตัวแรกเพื่อรับ Pet Haii และ QR Code"
          action={<Link className="btn btn-primary" to="/pets/new">เพิ่มน้องตัวแรก</Link>}
        />
      )}
    </div>
  );
}

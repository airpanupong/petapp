import {FormEvent, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation, useQuery} from '@tanstack/react-query';
import {Camera, Crown, Shield, Smartphone} from 'lucide-react';

import {getMyPosts, updateMe} from '../api/users.api';
import {uploadImage} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {isStaff, roleLabel} from '../lib/roles';
import {CatLoader} from '../components/CatLoader';
import {MyPostList} from '../components/MyPostList';
import {Avatar, ContactUs, EmptyState, PageTitle, SectionTitle, VersionTag} from '../components/ui';
import {NotificationSetting} from '../components/PermissionHints';
import {isStandalone} from '../lib/platform';
import {LogoutButton} from '../components/LogoutButton';

export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [name, setName] = useState(user?.display_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const posts = useQuery({queryKey: ['my-posts'], queryFn: getMyPosts});

  useEffect(() => {
    setName(user?.display_name ?? '');
    setPhone(user?.phone ?? '');
  }, [user]);

  const save = useMutation({
    mutationFn: (payload: {display_name?: string; phone?: string; avatar_url?: string}) => updateMe(payload),
    onSuccess: u => {
      setUser(u);
      toast.ok('บันทึกโปรไฟล์แล้ว');
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const changeAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      save.mutate({avatar_url: url});
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="page">
      <PageTitle title="โปรไฟล์" />
      <div className="split">
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <SectionTitle title="ประกาศของฉัน" />
          {posts.isLoading ? (
            <CatLoader label="กำลังรวบรวมประกาศ" />
          ) : posts.data && posts.data.lost.length + posts.data.found.length > 0 ? (
            <MyPostList lost={posts.data.lost} found={posts.data.found} />
          ) : (
            <EmptyState animal="dog" title="ยังไม่มีประกาศ" />
          )}
        </div>

        <div className="split-sticky" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <form
            className="card form"
            style={{alignItems: 'stretch'}}
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const ok = await confirmAction({title: 'บันทึกการแก้ไขโปรไฟล์?', message: 'ชื่อที่แสดงและเบอร์โทรจะอัปเดตในประกาศและแชทของคุณ', confirmLabel: 'บันทึก'});
              if (ok) save.mutate({display_name: name.trim(), phone: phone.trim() || undefined});
            }}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
              <div style={{position: 'relative'}}>
                <Avatar name={user?.display_name} url={user?.avatar_url} size="lg" />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => fileRef.current?.click()}
                  style={{position: 'absolute', right: -4, bottom: -4, background: '#fff', boxShadow: 'var(--shadow-soft)'}}
                  aria-label="เปลี่ยนรูป">
                  <Camera size={16} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void changeAvatar(e.target.files?.[0])} />
              </div>
              <div style={{textAlign: 'center'}}>
                <h2 style={{fontSize: 20}}>{user?.display_name}</h2>
                <p className="muted small">{user?.email}</p>
                {isStaff(user?.role) ? <span className="badge tone-lavender" style={{marginTop: 6}}><Crown size={13} /> {roleLabel(user?.role)}</span> : null}
              </div>
            </div>
            <label className="field">
              <span>อีเมล</span>
              <input className="input" type="email" value={user?.email ?? ''} readOnly disabled aria-readonly />
              <span className="field-hint">อีเมลใช้เข้าสู่ระบบ ไม่สามารถแก้ไขได้</span>
            </label>
            <label className="field">
              <span>ชื่อที่แสดง</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>เบอร์โทร</span>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={save.isPending}>บันทึก</button>
          </form>
          <NotificationSetting hideWhenOn />
          <div className="card form">
            {!isStandalone() ? (
              <Link to="/install" className="btn btn-soft">
                <Smartphone size={17} /> ติดตั้งแอปบนมือถือ
              </Link>
            ) : null}
            {isStaff(user?.role) ? (
              <Link to="/admin" className="btn btn-soft">
                <Shield size={17} /> ผู้ดูแลระบบ
              </Link>
            ) : null}
            <LogoutButton />
          </div>
          <ContactUs className="card" />
          <VersionTag />
        </div>
      </div>
    </div>
  );
}

import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, updatePassword, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, limit, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

async function reauth(user: User, password: string) {
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password));
}

export async function changePassword(user: User, current: string, next: string) {
  await reauth(user, current);
  await updatePassword(user, next);
}

/** 탈퇴: 질문 · 작성자 기록 삭제 → 가게 deleted(코드 재사용 금지) → users 삭제 → Auth 계정 삭제 */
export async function deleteAccount(user: User, password: string, code: string) {
  await reauth(user, password);
  for (const sub of ['questions', 'authors', 'blocked']) {
    for (;;) {
      const snap = await getDocs(query(collection(db, 'stores', code, sub), limit(200)));
      if (snap.empty) break;
      const b = writeBatch(db);
      snap.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  }
  await updateDoc(doc(db, 'stores', code), { status: 'deleted' });
  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
}

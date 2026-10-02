// ============================================================================
// VEBOSSO EMS — Departments Sheet (owner)
// Create, rename and delete departments, and choose who is in each. One
// department per person: ticking someone already in another department moves
// them here.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SmoothTextInput as TextInput } from './SmoothTextInput';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  createDepartment,
  deleteDepartment,
  DepartmentData,
  renameDepartment,
  setDepartmentMembers,
} from '../lib/departments';
import { Department, Profile } from '../types/database';
import { SheetFrame } from './SheetFrame';
import { UserAvatar } from './UserAvatar';

export function DepartmentsSheet({
  data,
  people,
  onDismiss,
  onChanged,
}: {
  data: DepartmentData;
  /** Everyone who can be put in a department. */
  people: Profile[];
  onDismiss: () => void;
  /** Reload the host's data; message for its snackbar. */
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState<Department | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const countIn = (id: string) => people.filter((p) => data.memberOf[p.id] === id).length;

  const add = async () => {
    if (!newName.trim()) return setError('Give the department a name');
    setBusy(true);
    const res = await createDepartment(newName);
    setBusy(false);
    if (!res.success) return setError(res.error);
    setNewName('');
    setError('');
    onChanged(`${res.data.name} created`);
    // Straight on to choosing who is in it.
    setEditing(res.data);
  };

  if (editing) {
    return (
      <DepartmentEditor
        key={editing.id}
        department={editing}
        data={data}
        people={people}
        onBack={() => setEditing(null)}
        onDismiss={onDismiss}
        onChanged={onChanged}
      />
    );
  }

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Departments"
      subtitle="Group your team on the home screen"
      icon="layers"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={(t) => {
                setNewName(t);
                if (error) setError('');
              }}
              placeholder="New department name"
              placeholderTextColor={T.mute}
              style={[styles.input, { flex: 1 }]}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <Pressable style={styles.addBtn} onPress={add} disabled={busy} accessibilityLabel="Create department">
              {busy ? <ActivityIndicator color={T.white} /> : <Feather name="plus" size={18} color={T.white} />}
            </Pressable>
          </View>
        </View>
      }
    >
      {data.departments.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="layers" size={22} color={T.mute} />
          <Text style={styles.emptyText}>No departments yet. Create one below, then add people to it.</Text>
        </View>
      ) : (
        data.departments.map((d) => {
          const n = countIn(d.id);
          return (
            <Pressable
              key={d.id}
              style={({ pressed }) => [styles.depRow, pressed && styles.pressed]}
              onPress={() => setEditing(d)}
              accessibilityRole="button"
              accessibilityLabel={`${d.name}, ${n} people, edit`}
            >
              <View style={styles.depIcon}>
                <Feather name="layers" size={15} color={T.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.depName} numberOfLines={1}>{d.name}</Text>
                <Text style={styles.depMeta}>{n === 0 ? 'No one yet' : n === 1 ? '1 person' : `${n} people`}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={T.mute} />
            </Pressable>
          );
        })
      )}
    </SheetFrame>
  );
}

// ----------------------------------------------------------------------------

function DepartmentEditor({
  department,
  data,
  people,
  onBack,
  onDismiss,
  onChanged,
}: {
  department: Department;
  data: DepartmentData;
  people: Profile[];
  onBack: () => void;
  onDismiss: () => void;
  onChanged: (message: string) => void;
}) {
  const [name, setName] = useState(department.name);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(people.filter((p) => data.memberOf[p.id] === department.id).map((p) => p.id))
  );
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState('');

  const depName = (id: string | undefined) => data.departments.find((d) => d.id === id)?.name;

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!name.trim()) return setError('Give the department a name');
    setBusy('save');
    setError('');
    if (name.trim() !== department.name) {
      const renamed = await renameDepartment(department.id, name);
      if (!renamed.success) {
        setBusy(null);
        return setError(renamed.error);
      }
    }
    const res = await setDepartmentMembers(department.id, [...chosen]);
    setBusy(null);
    if (!res.success) return setError(res.error);
    onChanged(`${name.trim()} saved`);
    onBack();
  };

  const remove = () =>
    Alert.alert('Delete department?', `${department.name} will be removed. The people in it stay on the team, without a department.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          const res = await deleteDepartment(department.id);
          setBusy(null);
          if (!res.success) return setError(res.error);
          onChanged(`${department.name} deleted`);
          onBack();
        },
      },
    ]);

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={department.name}
      subtitle={`${chosen.size} ${chosen.size === 1 ? 'person' : 'people'} · tap to add or remove`}
      icon="layers"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerRow}>
            <Pressable style={[styles.btn, styles.backBtn]} onPress={onBack} accessibilityLabel="Back to departments">
              <Feather name="arrow-left" size={16} color={T.inkSoft} />
            </Pressable>
            <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} disabled={busy !== null} accessibilityLabel="Delete department">
              {busy === 'delete' ? <ActivityIndicator color={T.coral} /> : <Feather name="trash-2" size={16} color={T.coral} />}
            </Pressable>
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={save} disabled={busy !== null}>
              {busy === 'save' ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      }
    >
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError('');
        }}
        style={styles.input}
        maxLength={60}
        returnKeyType="done"
      />

      <Text style={[styles.label, { marginTop: 16 }]}>People</Text>
      {people.length === 0 ? (
        <Text style={styles.depMeta}>No team members yet.</Text>
      ) : (
        people.map((p) => {
          const on = chosen.has(p.id);
          const elsewhere = !on && data.memberOf[p.id] && data.memberOf[p.id] !== department.id
            ? depName(data.memberOf[p.id])
            : undefined;
          return (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.personRow, on && styles.personOn, pressed && styles.pressed]}
              onPress={() => toggle(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.full_name}
            >
              <UserAvatar
                uri={p.avatar_url}
                size={34}
                label={p.full_name.substring(0, 2).toUpperCase()}
                style={{ backgroundColor: T.soft2 }}
                labelStyle={styles.avatarLabel}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.personName} numberOfLines={1}>{p.full_name}</Text>
                <Text style={styles.depMeta} numberOfLines={1}>
                  {elsewhere ? `In ${elsewhere} · ticking moves them here` : p.employee_id}
                </Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Feather name="check" size={14} color={T.white} /> : null}
              </View>
            </Pressable>
          );
        })
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 12 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.mute, textAlign: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  pressed: { backgroundColor: T.soft },
  depIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  depMeta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 1 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginBottom: 2,
  },
  personOn: { backgroundColor: T.blueSoft },
  personName: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  avatarLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, color: T.inkSoft },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: T.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: T.blue, borderColor: T.blue },
  footerRow: { flexDirection: 'row', gap: 8 },
  btn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 52, backgroundColor: T.soft },
  deleteBtn: { width: 52, backgroundColor: T.coralSoft },
  saveBtn: { flex: 1, backgroundColor: T.charcoal },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});

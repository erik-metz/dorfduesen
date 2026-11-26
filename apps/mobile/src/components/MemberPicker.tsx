import { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type PickerMember = { id: string; name: string; profile: string | null; city: string | null };

type Props = {
  members: PickerMember[];
  currentUserId?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
};

function firstName(member: PickerMember, isSelf: boolean) {
  return isSelf ? 'Du' : member.name.split(/\s+/)[0] || member.name;
}

function Avatar({ member, size, active }: { member: PickerMember; size: number; active?: boolean }) {
  const ring = active ? styles.ringActive : styles.ring;
  return <View style={[ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
    {member.profile
      ? <Image source={{ uri: member.profile }} alt="" style={{ width: size, height: size, borderRadius: size / 2 }} />
      : <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text allowFontScaling={false} style={[styles.initial, { fontSize: size * 0.4 }]}>{member.name.slice(0, 1).toUpperCase()}</Text>
      </View>}
  </View>;
}

export function MemberPicker({ members, currentUserId, selectedId, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // You first, then the currently selected athlete so a pick from the search list stays visible, then everyone else.
  const strip = useMemo(() => {
    const self = members.find(member => member.id === currentUserId);
    const selected = members.find(member => member.id === selectedId && member.id !== currentUserId);
    const rest = members.filter(member => member.id !== self?.id && member.id !== selected?.id);
    return [self, selected, ...rest].filter((member): member is PickerMember => Boolean(member));
  }, [currentUserId, members, selectedId]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de');
    if (!needle) return strip;
    return strip.filter(member => member.name.toLocaleLowerCase('de').includes(needle) || member.city?.toLocaleLowerCase('de').includes(needle));
  }, [query, strip]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery('');
  }

  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.strip}>
      {strip.map(member => {
        const active = member.id === selectedId;
        const isSelf = member.id === currentUserId;
        return <Pressable key={member.id} accessibilityRole="button" accessibilityLabel={isSelf ? `Du (${member.name})` : member.name}
          accessibilityState={{ selected: active }} onPress={() => choose(member.id)} style={styles.item}>
          <Avatar member={member} size={46} active={active} />
          <Text numberOfLines={1} allowFontScaling={false} style={[styles.name, active && styles.nameActive]}>{firstName(member, isSelf)}</Text>
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Alle Athleten durchsuchen" onPress={() => setOpen(true)} style={styles.item}>
        <View style={styles.searchButton}>
          <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
            <Circle cx={11} cy={11} r={7} stroke="#fafafa" strokeWidth={2} fill="none" />
            <Path d="m20 20-4-4" stroke="#fafafa" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text numberOfLines={1} allowFontScaling={false} style={styles.name}>Alle</Text>
      </Pressable>
    </ScrollView>

    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Athlet wählen</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={8} onPress={() => setOpen(false)}>
            <Text style={styles.close}>Fertig</Text>
          </Pressable>
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder={`${members.length} Athleten durchsuchen`} placeholderTextColor="#71717a"
          autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" returnKeyType="search" style={styles.search}
          accessibilityLabel="Athleten durchsuchen" />
        <FlatList data={results} keyExtractor={member => member.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          ListEmptyComponent={<Text style={styles.empty}>Keine Athleten gefunden.</Text>}
          renderItem={({ item }) => {
            const active = item.id === selectedId;
            const isSelf = item.id === currentUserId;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => choose(item.id)} style={styles.row}>
              <Avatar member={item} size={36} active={active} />
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={styles.rowName}>{item.name}{isSelf ? ' (Du)' : ''}</Text>
                {item.city ? <Text numberOfLines={1} style={styles.rowCity}>{item.city}</Text> : null}
              </View>
              {active ? <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
                <Path d="m5 12 4 4L19 6" stroke="#fc7a3d" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg> : null}
            </Pressable>;
          }} />
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  // Phone-sized strip on every device: fixed height, no flex growth and no text scaling, so a large iPad or tablet
  // shows the same compact avatars instead of stretching them.
  stripScroll: { flexGrow: 0, flexShrink: 0, height: 74 },
  strip: { gap: 12, paddingRight: 4, alignItems: 'flex-start' },
  item: { width: 58, height: 74, flexGrow: 0, flexShrink: 0, alignItems: 'center', gap: 4 },
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  ringActive: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fc7a3d' },
  placeholder: { backgroundColor: '#3f3f46', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fafafa', fontWeight: '800' },
  name: { color: '#a1a1aa', fontSize: 11, fontWeight: '700', maxWidth: 58 },
  nameActive: { color: '#fb923c' },
  searchButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: '#09090b', paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: '#fafafa', fontSize: 20, fontWeight: '800' },
  close: { color: '#fb923c', fontSize: 16, fontWeight: '700' },
  search: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46', backgroundColor: '#18181b', color: '#fafafa', paddingHorizontal: 12, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#27272a' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { color: '#fafafa', fontSize: 16, fontWeight: '600' },
  rowCity: { color: '#a1a1aa', fontSize: 13 },
  empty: { color: '#a1a1aa', textAlign: 'center', marginTop: 24 },
});

import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OwnerPetBadge } from './avatar';
import { Icon } from './icon';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { timeAgo } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { EventComment, PetEvent } from '@/lib/types';

function CommentRow({
  comment,
  event,
  isReply,
  onReply,
}: {
  comment: EventComment;
  event: PetEvent;
  isReply: boolean;
  onReply: (c: EventComment) => void;
}) {
  const p = usePalette();
  const store = useStore();
  const author = store.users[comment.authorId];
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);

  if (!author) return null;
  const isMine = comment.authorId === store.currentUserId;
  const iAmHost = event.hostId === store.currentUserId;
  const authorIsHost = comment.authorId === event.hostId;
  const authorGoing = store.rsvps.some(
    (r) => r.eventId === event.id && r.userId === comment.authorId && r.status === 'going',
  );
  const pet = Object.values(store.pets).find((x) => x.ownerId === author.id);
  const locked = event.status !== 'active';

  if (comment.deletedBy) {
    return (
      <View style={[styles.row, isReply && styles.reply]}>
        <Text style={[styles.deleted, { color: p.textSecondary }]}>
          {comment.deletedBy === 'host' ? 'Removed by host' : 'Deleted by author'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isReply && styles.reply]}>
      <OwnerPetBadge user={author} pet={pet} size={34} />
      <View style={styles.bubbleCol}>
        <View style={styles.authorLine}>
          <Text style={[styles.author, { color: p.text }]}>{author.displayName}</Text>
          {authorIsHost ? (
            <View style={[styles.roleChip, { borderColor: p.accent }]}>
              <Text style={[styles.roleChipText, { color: p.accent }]}>Host</Text>
            </View>
          ) : authorGoing ? (
            <View style={[styles.roleChip, { borderColor: p.success }]}>
              <Text style={[styles.roleChipText, { color: p.success }]}>Going</Text>
            </View>
          ) : null}
          <Text style={[styles.time, { color: p.textSecondary }]}>
            {timeAgo(comment.createdAt)}
            {comment.editedAt ? ' · edited' : ''}
          </Text>
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              style={[styles.editInput, { color: p.text, borderColor: p.separator }]}
            />
            <View style={styles.actionsLine}>
              <Pressable onPress={() => setEditing(false)}>
                <Text style={[styles.action, { color: p.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const trimmed = editText.trim();
                  if (trimmed) store.editComment(comment.id, trimmed);
                  setEditing(false);
                }}>
                <Text style={[styles.action, { color: p.accent }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={[styles.body, { color: p.text }]}>{comment.body}</Text>
        )}

        {!locked && !editing ? (
          <View style={styles.actionsLine}>
            {!isReply ? (
              <Pressable onPress={() => onReply(comment)}>
                <Text style={[styles.action, { color: p.textSecondary }]}>Reply</Text>
              </Pressable>
            ) : null}
            {isMine ? (
              <>
                <Pressable onPress={() => { setEditText(comment.body); setEditing(true); }}>
                  <Text style={[styles.action, { color: p.textSecondary }]}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete comment?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => store.deleteComment(comment.id, 'author'),
                      },
                    ])
                  }>
                  <Text style={[styles.action, { color: p.danger }]}>Delete</Text>
                </Pressable>
              </>
            ) : iAmHost ? (
              <Pressable
                onPress={() =>
                  Alert.alert('Remove this comment?', 'As the host you can remove comments on your event.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => store.deleteComment(comment.id, 'host'),
                    },
                  ])
                }>
                <Text style={[styles.action, { color: p.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function CommentsSection({ event }: { event: PetEvent }) {
  const p = usePalette();
  const store = useStore();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<EventComment | null>(null);

  const all = store.comments.filter((c) => c.eventId === event.id);
  const topLevel = all
    .filter((c) => !c.parentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const repliesFor = (id: string) =>
    all.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const locked = event.status !== 'active';
  const visibleCount = all.filter((c) => !c.deletedBy).length;

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    store.addComment(event.id, trimmed, replyTo?.id);
    setText('');
    setReplyTo(null);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: p.text }]}>
        Comments{visibleCount > 0 ? ` (${visibleCount})` : ''}
      </Text>

      {locked ? (
        <View style={[styles.lockedBanner, { backgroundColor: p.chipBg }]}>
          <Icon sf="lock.fill" size={13} color={p.textSecondary} />
          <Text style={[styles.lockedText, { color: p.textSecondary }]}>
            This event is archived — comments are closed.
          </Text>
        </View>
      ) : (
        <View style={[styles.composer, { backgroundColor: p.card, borderColor: p.separator }]}>
          {replyTo ? (
            <View style={styles.replyingTo}>
              <Text style={[styles.replyingText, { color: p.textSecondary }]} numberOfLines={1}>
                Replying to {store.users[replyTo.authorId]?.displayName}
              </Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <Icon sf="xmark.circle.fill" size={16} color={p.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Write a reply…' : 'Ask the host a question…'}
              placeholderTextColor={p.textSecondary}
              multiline
              maxLength={1000}
              style={[styles.input, { color: p.text }]}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim()}
              accessibilityLabel="Send comment"
              style={{ opacity: text.trim() ? 1 : 0.35 }}>
              <Icon sf="paperplane.circle.fill" size={30} color={p.accent} />
            </Pressable>
          </View>
        </View>
      )}

      {topLevel.length === 0 && !locked ? (
        <Text style={[styles.empty, { color: p.textSecondary }]}>
          No comments yet — questions about parking, puppies, or treats go here.
        </Text>
      ) : null}

      {topLevel.map((c) => (
        <View key={c.id} style={styles.thread}>
          <CommentRow comment={c} event={event} isReply={false} onReply={setReplyTo} />
          {repliesFor(c.id).map((r) => (
            <CommentRow key={r.id} comment={r} event={event} isReply onReply={setReplyTo} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  heading: { fontSize: 20, fontWeight: '700', fontFamily: Fonts?.rounded },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.three,
    borderRadius: Radii.md,
  },
  lockedText: { fontSize: 13, fontWeight: '600', flex: 1 },
  composer: {
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
    gap: 6,
  },
  replyingTo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  replyingText: { fontSize: 12, fontWeight: '600', flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, fontSize: 15, maxHeight: 120, paddingHorizontal: 6, paddingVertical: 8 },
  empty: { fontSize: 13, lineHeight: 18 },
  thread: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  reply: { marginLeft: Spacing.five, marginTop: Spacing.two },
  bubbleCol: { flex: 1, gap: 3 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  author: { fontSize: 14, fontWeight: '700' },
  roleChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  time: { fontSize: 12 },
  body: { fontSize: 15, lineHeight: 21 },
  actionsLine: { flexDirection: 'row', gap: Spacing.three, marginTop: 2 },
  action: { fontSize: 13, fontWeight: '700' },
  deleted: { fontSize: 13, fontStyle: 'italic' },
  editWrap: { gap: 6 },
  editInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.sm,
    padding: 8,
    fontSize: 15,
  },
});

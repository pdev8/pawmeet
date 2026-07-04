import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { useStore } from '@/lib/store';

export default function TabLayout() {
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>Discover</Label>
        <Icon sf="magnifyingglass" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="post">
        <Label>Post</Label>
        <Icon sf="plus.circle.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <Label>Inbox</Label>
        <Icon sf="bell.fill" />
        {unread > 0 ? <Badge>{String(unread)}</Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
